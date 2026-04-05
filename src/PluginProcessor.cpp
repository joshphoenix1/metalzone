#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace juce;

//==============================================================================
MetalZoneProcessor::MetalZoneProcessor()
    : AudioProcessor (BusesProperties()
                        .withInput  ("Input",  AudioChannelSet::stereo(), true)
                        .withOutput ("Output", AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "PARAMS", createParameterLayout())
{
}

//==============================================================================
AudioProcessorValueTreeState::ParameterLayout MetalZoneProcessor::createParameterLayout()
{
    using P = AudioParameterFloat;
    std::vector<std::unique_ptr<RangedAudioParameter>> params;

    params.push_back (std::make_unique<P>(
        ParameterID{"level", 1}, "Level",
        NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.5f));

    params.push_back (std::make_unique<P>(
        ParameterID{"dist", 1}, "Dist",
        NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.5f));

    params.push_back (std::make_unique<P>(
        ParameterID{"low", 1}, "Low",
        NormalisableRange<float>(-15.0f, 15.0f, 0.01f), 0.0f));

    params.push_back (std::make_unique<P>(
        ParameterID{"mid", 1}, "Mid",
        NormalisableRange<float>(-15.0f, 15.0f, 0.01f), 0.0f));

    // Mid frequency: 200 Hz .. 5000 Hz, skewed for log-ish feel
    NormalisableRange<float> midFreqRange (200.0f, 5000.0f, 1.0f);
    midFreqRange.setSkewForCentre (1000.0f);
    params.push_back (std::make_unique<P>(
        ParameterID{"midFreq", 1}, "Mid Freq", midFreqRange, 500.0f));

    params.push_back (std::make_unique<P>(
        ParameterID{"high", 1}, "High",
        NormalisableRange<float>(-15.0f, 15.0f, 0.01f), 0.0f));

    return { params.begin(), params.end() };
}

//==============================================================================
void MetalZoneProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    baseSampleRate = sampleRate;
    const size_t oversampleFactor = size_t(1) << kOsStages; // 4
    osSampleRate = sampleRate * (double) oversampleFactor;

    oversampler = std::make_unique<dsp::Oversampling<float>>(
        2, kOsStages,
        dsp::Oversampling<float>::filterHalfBandPolyphaseIIR,
        true, false);
    oversampler->initProcessing (static_cast<size_t>(samplesPerBlock));
    oversampler->reset();

    for (int ch = 0; ch < 2; ++ch)
    {
        dcBlocker[ch].reset();
        interstageHPF[ch].reset();
        lowShelf[ch].reset();
        midPeak[ch].reset();
        highShelf[ch].reset();
    }

    updateStaticCoefficients();
    updateToneStackCoefficients();
}

void MetalZoneProcessor::releaseResources()
{
    if (oversampler) oversampler->reset();
}

bool MetalZoneProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto& mainOut = layouts.getMainOutputChannelSet();
    if (mainOut != AudioChannelSet::mono() && mainOut != AudioChannelSet::stereo())
        return false;
    return mainOut == layouts.getMainInputChannelSet();
}

//==============================================================================
void MetalZoneProcessor::updateStaticCoefficients()
{
    // DC blocker at base rate: HPF ~25 Hz
    auto dcCoeffs = dsp::IIR::Coefficients<float>::makeHighPass (baseSampleRate, 25.0f, 0.707f);
    for (int ch = 0; ch < 2; ++ch)
        *dcBlocker[ch].coefficients = *dcCoeffs;

    // Interstage HPF at OS rate: ~720 Hz (shapes MT-2 "scoop-then-growl" character)
    auto isCoeffs = dsp::IIR::Coefficients<float>::makeHighPass (osSampleRate, 720.0f, 0.707f);
    for (int ch = 0; ch < 2; ++ch)
        *interstageHPF[ch].coefficients = *isCoeffs;
}

void MetalZoneProcessor::updateToneStackCoefficients()
{
    const float lowGain  = Decibels::decibelsToGain (lowDb);
    const float midGain  = Decibels::decibelsToGain (midDb);
    const float highGain = Decibels::decibelsToGain (highDb);

    auto lowC  = dsp::IIR::Coefficients<float>::makeLowShelf  (baseSampleRate, 100.0f,  0.707f, lowGain);
    auto midC  = dsp::IIR::Coefficients<float>::makePeakFilter(baseSampleRate, midFreqHz, 0.7f,  midGain);
    auto highC = dsp::IIR::Coefficients<float>::makeHighShelf (baseSampleRate, 8000.0f, 0.707f, highGain);

    for (int ch = 0; ch < 2; ++ch)
    {
        *lowShelf[ch].coefficients  = *lowC;
        *midPeak[ch].coefficients   = *midC;
        *highShelf[ch].coefficients = *highC;
    }
}

//==============================================================================
void MetalZoneProcessor::processBlock (AudioBuffer<float>& buffer, MidiBuffer&)
{
    ScopedNoDenormals noDenormals;
    const int numCh      = buffer.getNumChannels();
    const int numSamples = buffer.getNumSamples();

    // --- Read parameters (atomic load, once per block) ---
    distAmt   = apvts.getRawParameterValue ("dist")   ->load();
    levelAmt  = apvts.getRawParameterValue ("level")  ->load();
    lowDb     = apvts.getRawParameterValue ("low")    ->load();
    midDb     = apvts.getRawParameterValue ("mid")    ->load();
    midFreqHz = apvts.getRawParameterValue ("midFreq")->load();
    highDb    = apvts.getRawParameterValue ("high")   ->load();

    updateToneStackCoefficients();

    // --- 1. DC block at base rate ---
    for (int ch = 0; ch < numCh; ++ch)
    {
        auto* data = buffer.getWritePointer (ch);
        for (int i = 0; i < numSamples; ++i)
            data[i] = dcBlocker[ch].processSample (data[i]);
    }

    // --- 2. Pre-gain from DIST knob: 1x .. ~200x (exponential) ---
    const float preGain = std::pow (10.0f, distAmt * 2.3f); // 10^(0..2.3) = 1..200
    buffer.applyGain (preGain);

    // --- 3. Oversample, clip-HPF-clip, downsample ---
    dsp::AudioBlock<float> block (buffer);
    auto osBlock = oversampler->processSamplesUp (block);

    const int osCh      = (int) osBlock.getNumChannels();
    const int osSamples = (int) osBlock.getNumSamples();

    for (int ch = 0; ch < osCh; ++ch)
    {
        auto* data = osBlock.getChannelPointer ((size_t) ch);
        const int filterCh = juce::jmin (ch, 1);

        for (int i = 0; i < osSamples; ++i)
        {
            float x = data[i];

            // Stage 1: symmetric soft clip (op-amp + diodes in feedback, first stage)
            x = std::tanh (x);

            // Interstage HPF — shapes the mids between clipping stages
            x = interstageHPF[filterCh].processSample (x);

            // Stage 2: asymmetric soft clip (slight DC bias before tanh)
            // Removes the DC offset after clipping so we don't accumulate bias.
            constexpr float bias = 0.15f;
            x = std::tanh (x * 1.6f + bias) - std::tanh (bias);

            data[i] = x;
        }
    }

    oversampler->processSamplesDown (block);

    // --- 4. Tone stack at base rate: Low → Mid → High ---
    for (int ch = 0; ch < numCh; ++ch)
    {
        auto* data = buffer.getWritePointer (ch);
        for (int i = 0; i < numSamples; ++i)
        {
            float x = data[i];
            x = lowShelf[ch].processSample (x);
            x = midPeak[ch].processSample (x);
            x = highShelf[ch].processSample (x);
            data[i] = x;
        }
    }

    // --- 5. Output level ---
    // Compensate roughly for the pre-gain so LEVEL=0.5 sits around unity.
    const float makeupComp = 0.15f; // trim — tanh post-clip is ~±1 regardless of input
    buffer.applyGain (levelAmt * makeupComp * 2.0f); // *2 so 0.5 ≈ unity
}

//==============================================================================
AudioProcessorEditor* MetalZoneProcessor::createEditor()
{
    return new MetalZoneEditor (*this);
}

void MetalZoneProcessor::getStateInformation (MemoryBlock& destData)
{
    if (auto state = apvts.copyState(); state.isValid())
    {
        std::unique_ptr<XmlElement> xml (state.createXml());
        copyXmlToBinary (*xml, destData);
    }
}

void MetalZoneProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<XmlElement> xml (getXmlFromBinary (data, sizeInBytes));
    if (xml != nullptr && xml->hasTagName (apvts.state.getType()))
        apvts.replaceState (ValueTree::fromXml (*xml));
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MetalZoneProcessor();
}
