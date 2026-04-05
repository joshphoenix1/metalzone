#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>

class MetalZoneProcessor : public juce::AudioProcessor
{
public:
    MetalZoneProcessor();
    ~MetalZoneProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MetalZone"; }
    bool acceptsMidi()  const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // Oversampling: 2 stages of 2x → 4x oversampling for nonlinear stages
    static constexpr size_t kOsStages = 2;
    std::unique_ptr<juce::dsp::Oversampling<float>> oversampler;

    // DC blocker at base rate (per channel)
    juce::dsp::IIR::Filter<float> dcBlocker[2];

    // Interstage HPF at OS rate (per channel) — shapes mids between clipping stages
    juce::dsp::IIR::Filter<float> interstageHPF[2];

    // Tone stack at base rate (per channel)
    juce::dsp::IIR::Filter<float> lowShelf[2];
    juce::dsp::IIR::Filter<float> midPeak[2];
    juce::dsp::IIR::Filter<float> highShelf[2];

    double baseSampleRate = 44100.0;
    double osSampleRate   = 44100.0 * 4.0;

    // Cached param values (updated once per block)
    float distAmt   = 0.5f;
    float levelAmt  = 0.5f;
    float lowDb     = 0.0f;
    float midDb     = 0.0f;
    float midFreqHz = 500.0f;
    float highDb    = 0.0f;

    void updateToneStackCoefficients();
    void updateStaticCoefficients();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MetalZoneProcessor)
};
