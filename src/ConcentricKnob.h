#pragma once

#include <juce_gui_basics/juce_gui_basics.h>
#include <juce_audio_processors/juce_audio_processors.h>

// ==========================================================================
// ConcentricKnob — two rotary sliders sharing a center:
//   Outer  : larger ring, controlled by grabbing the outer annulus
//   Inner  : smaller cap on top, controlled by grabbing the center
// Matches MT-2 dual-concentric EQ knobs (HIGH/LOW and MID FREQ/MID).
// ==========================================================================
class ConcentricKnob : public juce::Component
{
public:
    ConcentricKnob (juce::AudioProcessorValueTreeState& apvts,
                    const juce::String& outerParamID,
                    const juce::String& innerParamID,
                    const juce::String& outerLabel,
                    const juce::String& innerLabel)
    {
        auto setup = [] (juce::Slider& s)
        {
            s.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
            s.setTextBoxStyle (juce::Slider::NoTextBox, false, 0, 0);
            s.setRotaryParameters (juce::MathConstants<float>::pi * 1.2f,
                                   juce::MathConstants<float>::pi * 2.8f,
                                   true);
        };

        setup (outer);
        setup (inner);

        addAndMakeVisible (outer);
        addAndMakeVisible (inner);

        outerAttachment = std::make_unique<Attachment>(apvts, outerParamID, outer);
        innerAttachment = std::make_unique<Attachment>(apvts, innerParamID, inner);

        outerCaption.setText (outerLabel, juce::dontSendNotification);
        innerCaption.setText (innerLabel, juce::dontSendNotification);
        for (auto* l : { &outerCaption, &innerCaption })
        {
            l->setJustificationType (juce::Justification::centred);
            l->setColour (juce::Label::textColourId, juce::Colour (0xff1a1a1a));
            l->setFont (juce::Font (juce::FontOptions (10.0f).withStyle ("Bold")));
            addAndMakeVisible (*l);
        }

        // Inner slider sits on top visually; outer is behind.
        inner.toFront (false);
    }

    void resized() override
    {
        auto bounds = getLocalBounds();
        auto captionsArea = bounds.removeFromBottom (26);
        outerCaption.setBounds (captionsArea.removeFromLeft (captionsArea.getWidth() / 2));
        innerCaption.setBounds (captionsArea);

        // Outer: fills bounds. Inner: centered, ~55% diameter.
        const int side = juce::jmin (bounds.getWidth(), bounds.getHeight());
        auto square = bounds.withSizeKeepingCentre (side, side);
        outer.setBounds (square);

        const int innerSide = juce::roundToInt (side * 0.55f);
        inner.setBounds (square.withSizeKeepingCentre (innerSide, innerSide));
    }

    // Route mouse events: center → inner, outer annulus → outer
    bool hitTest (int x, int y) override
    {
        juce::ignoreUnused (x, y);
        return true;
    }

    void mouseDown (const juce::MouseEvent& e) override    { routeMouse (e, true,  false, false); }
    void mouseDrag (const juce::MouseEvent& e) override    { routeMouse (e, false, true,  false); }
    void mouseUp   (const juce::MouseEvent& e) override    { routeMouse (e, false, false, true);  }
    void mouseWheelMove (const juce::MouseEvent& e,
                         const juce::MouseWheelDetails& w) override
    {
        auto* target = selectTarget (e);
        if (target) target->mouseWheelMove (e.getEventRelativeTo (target), w);
    }

private:
    using Attachment = juce::AudioProcessorValueTreeState::SliderAttachment;

    juce::Slider* selectTarget (const juce::MouseEvent& e)
    {
        const auto innerBounds = inner.getBounds().toFloat();
        const auto centre = innerBounds.getCentre();
        const float radius = innerBounds.getWidth() * 0.5f;
        const float dx = (float) e.x - centre.x;
        const float dy = (float) e.y - centre.y;
        return (dx * dx + dy * dy <= radius * radius) ? static_cast<juce::Slider*>(&inner)
                                                      : static_cast<juce::Slider*>(&outer);
    }

    void routeMouse (const juce::MouseEvent& e, bool isDown, bool isDrag, bool isUp)
    {
        if (isDown)
            active = selectTarget (e);
        if (active == nullptr) return;

        auto rel = e.getEventRelativeTo (active);
        if (isDown) active->mouseDown (rel);
        if (isDrag) active->mouseDrag (rel);
        if (isUp)   { active->mouseUp (rel); active = nullptr; }
    }

    juce::Slider outer, inner;
    juce::Slider* active = nullptr;
    std::unique_ptr<Attachment> outerAttachment;
    std::unique_ptr<Attachment> innerAttachment;
    juce::Label outerCaption, innerCaption;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ConcentricKnob)
};
