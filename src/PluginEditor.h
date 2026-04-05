#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "PluginProcessor.h"
#include "PedalLookAndFeel.h"
#include "ConcentricKnob.h"

class MetalZoneEditor : public juce::AudioProcessorEditor
{
public:
    explicit MetalZoneEditor (MetalZoneProcessor&);
    ~MetalZoneEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    MetalZoneProcessor& processor;
    PedalLookAndFeel pedalLnF;
    juce::Image pedalImage;

    using APVTS = juce::AudioProcessorValueTreeState;
    using SliderAttachment = APVTS::SliderAttachment;

    // Single knobs: LEVEL and DIST
    juce::Slider levelSlider, distSlider;
    juce::Label  levelLabel, distLabel;
    std::unique_ptr<SliderAttachment> levelAttachment, distAttachment;

    // Dual-concentric EQ knobs
    std::unique_ptr<ConcentricKnob> eqHighLow;   // HIGH (outer) + LOW (inner)
    std::unique_ptr<ConcentricKnob> eqMidFreq;   // MID FREQ (outer) + MIDDLE (inner)

    void setupSingleKnob (juce::Slider& s, juce::Label& l,
                          const juce::String& paramID,
                          const juce::String& labelText,
                          std::unique_ptr<SliderAttachment>& att);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MetalZoneEditor)
};
