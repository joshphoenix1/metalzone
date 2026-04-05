#include "PluginEditor.h"
#include <BinaryData.h>

using namespace juce;

// Image is 593x1050. Editor is scaled to 380x673 (factor ≈ 0.64).
namespace
{
    constexpr int   kEditorWidth  = 380;
    constexpr int   kEditorHeight = 673;

    // Normalized knob centres as fractions of editor size
    // (same coordinates used in web/style.css for the web demo).
    constexpr float kKnobY        = 0.135f;
    constexpr float kKnobXLevel   = 0.16f;
    constexpr float kKnobXHighLow = 0.35f;
    constexpr float kKnobXMidFreq = 0.61f;
    constexpr float kKnobXDist    = 0.83f;

    // Single-knob diameter + concentric outer/inner sizes (in editor px)
    constexpr int   kSingleKnobSize    = 44;
    constexpr int   kConcentricOuterSz = 60;
}

//==============================================================================
MetalZoneEditor::MetalZoneEditor (MetalZoneProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setLookAndFeel (&pedalLnF);

    pedalImage = ImageCache::getFromMemory (BinaryData::mt2galpng,
                                            BinaryData::mt2galpngSize);

    setupSingleKnob (levelSlider, levelLabel, "level", "", levelAttachment);
    setupSingleKnob (distSlider,  distLabel,  "dist",  "", distAttachment);

    eqHighLow = std::make_unique<ConcentricKnob>(processor.apvts, "high", "low", "", "");
    eqMidFreq = std::make_unique<ConcentricKnob>(processor.apvts, "midFreq", "mid", "", "");
    addAndMakeVisible (*eqHighLow);
    addAndMakeVisible (*eqMidFreq);

    // Labels are in the image already — we don't draw them.
    levelLabel.setVisible (false);
    distLabel.setVisible (false);

    setSize (kEditorWidth, kEditorHeight);
}

MetalZoneEditor::~MetalZoneEditor()
{
    setLookAndFeel (nullptr);
}

void MetalZoneEditor::setupSingleKnob (Slider& s, Label& l,
                                       const String& paramID,
                                       const String&,
                                       std::unique_ptr<SliderAttachment>& att)
{
    s.setSliderStyle (Slider::RotaryHorizontalVerticalDrag);
    s.setTextBoxStyle (Slider::NoTextBox, false, 0, 0);
    s.setRotaryParameters (MathConstants<float>::pi * 1.2f,
                           MathConstants<float>::pi * 2.8f, true);
    addAndMakeVisible (s);
    ignoreUnused (l);
    att = std::make_unique<SliderAttachment>(processor.apvts, paramID, s);
}

//==============================================================================
void MetalZoneEditor::paint (Graphics& g)
{
    g.fillAll (Colours::black);

    if (pedalImage.isValid())
    {
        g.drawImage (pedalImage,
                     getLocalBounds().toFloat(),
                     RectanglePlacement::stretchToFit, false);
    }
    else
    {
        // Fallback if image failed to load
        g.setColour (Colour (0xff2a2a2a));
        g.fillRect (getLocalBounds());
        g.setColour (Colour (0xffff6a00));
        g.setFont (Font (FontOptions (20.0f).withStyle ("Bold")));
        g.drawText ("METAL ZONE (image missing)",
                    getLocalBounds(), Justification::centred);
    }
}

void MetalZoneEditor::resized()
{
    const int w = getWidth();
    const int h = getHeight();

    auto placeCentred = [&] (Component& c, float xFrac, float yFrac, int size)
    {
        const int cx = (int) (xFrac * w);
        const int cy = (int) (yFrac * h);
        c.setBounds (cx - size / 2, cy - size / 2, size, size);
    };

    placeCentred (levelSlider, kKnobXLevel,   kKnobY, kSingleKnobSize);
    placeCentred (*eqHighLow,  kKnobXHighLow, kKnobY, kConcentricOuterSz);
    placeCentred (*eqMidFreq,  kKnobXMidFreq, kKnobY, kConcentricOuterSz);
    placeCentred (distSlider,  kKnobXDist,    kKnobY, kSingleKnobSize);
}
