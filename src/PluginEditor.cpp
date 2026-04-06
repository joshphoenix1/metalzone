#include "PluginEditor.h"
#include <BinaryData.h>

using namespace juce;

// Image is 593x1050. Editor is scaled to 380x673 (factor ≈ 0.64).
namespace
{
    constexpr int   kEditorWidth  = 380;
    constexpr int   kEditorHeight = 673;

    // Normalized knob centres as fractions of editor size,
    // matched to the knob positions on the mt2-gal.png image.
    constexpr float kKnobYLevel   = 0.136f;
    constexpr float kKnobYDist    = 0.136f;
    constexpr float kKnobYEQ      = 0.155f;
    constexpr float kKnobXLevel   = 0.18f;
    constexpr float kKnobXHighLow = 0.37f;
    constexpr float kKnobXMidFreq = 0.62f;
    constexpr float kKnobXDist    = 0.83f;

    // Single-knob diameter + concentric outer/inner sizes (in editor px)
    constexpr int   kSingleKnobSize    = 55;
    constexpr int   kConcentricOuterSz = 78;
}

//==============================================================================
MetalZoneEditor::MetalZoneEditor (MetalZoneProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setLookAndFeel (&pedalLnF);

    // JUCE's namedResourceList stores the C++-identifier version of the filename
    // (hyphens/dots → underscores). Try candidates in order.
    int imgSize = 0;
    const char* candidates[] = { "mt2_gal_png", "mt2-gal.png", "mt2galpng" };
    for (auto* name : candidates)
    {
        if (auto* imgData = BinaryData::getNamedResource (name, imgSize))
        {
            pedalImage = ImageCache::getFromMemory (imgData, imgSize);
            break;
        }
    }
    // Last-resort fallback: scan namedResourceList for anything PNG-ish
    if (! pedalImage.isValid())
    {
        for (int i = 0; i < BinaryData::namedResourceListSize; ++i)
        {
            const char* name = BinaryData::namedResourceList[i];
            if (juce::String (name).containsIgnoreCase ("png")
                || juce::String (name).containsIgnoreCase ("gal"))
            {
                if (auto* imgData = BinaryData::getNamedResource (name, imgSize))
                {
                    pedalImage = ImageCache::getFromMemory (imgData, imgSize);
                    break;
                }
            }
        }
    }

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

    placeCentred (levelSlider, kKnobXLevel,   kKnobYLevel, kSingleKnobSize);
    placeCentred (*eqHighLow,  kKnobXHighLow, kKnobYEQ,    kConcentricOuterSz);
    placeCentred (*eqMidFreq,  kKnobXMidFreq, kKnobYEQ,    kConcentricOuterSz);
    placeCentred (distSlider,  kKnobXDist,    kKnobYDist,  kSingleKnobSize);
}
