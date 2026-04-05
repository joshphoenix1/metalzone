#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

// ==========================================================================
// Pedal-style LookAndFeel — MT-2 Metal Zone inspired.
// Black knob caps with chrome rims and a white indicator line.
// ==========================================================================
class PedalLookAndFeel : public juce::LookAndFeel_V4
{
public:
    PedalLookAndFeel()
    {
        setColour (juce::Slider::textBoxTextColourId,       juce::Colour (0xff202020));
        setColour (juce::Slider::textBoxBackgroundColourId, juce::Colours::transparentBlack);
        setColour (juce::Slider::textBoxOutlineColourId,    juce::Colours::transparentBlack);
    }

    void drawRotarySlider (juce::Graphics& g,
                           int x, int y, int width, int height,
                           float sliderPos,
                           float rotaryStartAngle,
                           float rotaryEndAngle,
                           juce::Slider&) override
    {
        using namespace juce;

        const float radius = (float) juce::jmin (width, height) * 0.5f - 2.0f;
        const float cx = (float) x + (float) width  * 0.5f;
        const float cy = (float) y + (float) height * 0.5f;
        const float angle = rotaryStartAngle + sliderPos * (rotaryEndAngle - rotaryStartAngle);

        // Chrome rim (thin silver ring)
        {
            Rectangle<float> rim (cx - radius, cy - radius, radius * 2.0f, radius * 2.0f);
            ColourGradient rimGrad (Colour (0xffe8e8e8), cx, cy - radius,
                                    Colour (0xff707070), cx, cy + radius, false);
            g.setGradientFill (rimGrad);
            g.fillEllipse (rim);
        }

        // Knob body (black with subtle vertical gradient)
        const float bodyR = radius - 3.0f;
        {
            Rectangle<float> body (cx - bodyR, cy - bodyR, bodyR * 2.0f, bodyR * 2.0f);
            ColourGradient bodyGrad (Colour (0xff303030), cx, cy - bodyR,
                                     Colour (0xff0a0a0a), cx, cy + bodyR, false);
            g.setGradientFill (bodyGrad);
            g.fillEllipse (body);
        }

        // Subtle highlight ring
        g.setColour (Colour (0x22ffffff));
        g.drawEllipse (cx - bodyR, cy - bodyR, bodyR * 2.0f, bodyR * 2.0f, 1.0f);

        // Indicator line (white pointer from center to rim)
        Path pointer;
        const float pointerLen   = bodyR - 4.0f;
        const float pointerWidth = 2.8f;
        pointer.addRectangle (-pointerWidth * 0.5f, -pointerLen, pointerWidth, pointerLen - bodyR * 0.35f);
        pointer.applyTransform (AffineTransform::rotation (angle).translated (cx, cy));
        g.setColour (Colours::white);
        g.fillPath (pointer);

        // Center dot
        g.setColour (Colour (0xff1a1a1a));
        g.fillEllipse (cx - 2.0f, cy - 2.0f, 4.0f, 4.0f);
    }

    juce::Font getLabelFont (juce::Label& label) override
    {
        return juce::Font (juce::FontOptions (label.getFont().getHeight()).withStyle ("Bold"));
    }
};
