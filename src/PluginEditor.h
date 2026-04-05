#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "PluginProcessor.h"

class MetalZoneEditor : public juce::AudioProcessorEditor
{
public:
    explicit MetalZoneEditor (MetalZoneProcessor&);
    ~MetalZoneEditor() override = default;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    MetalZoneProcessor& processor;

    using APVTS = juce::AudioProcessorValueTreeState;
    using SliderAttachment = APVTS::SliderAttachment;

    struct KnobControl
    {
        juce::Slider slider;
        juce::Label  label;
        std::unique_ptr<SliderAttachment> attachment;
    };

    KnobControl level, dist, low, mid, midFreq, high;

    void setupKnob (KnobControl& k, const juce::String& paramID, const juce::String& labelText);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MetalZoneEditor)
};
