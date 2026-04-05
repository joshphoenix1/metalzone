#include "PluginEditor.h"

using namespace juce;

namespace
{
    const Colour kBackground   { 0xff1a1a1a };
    const Colour kPanel        { 0xff2a2a2a };
    const Colour kAccent       { 0xffff6a00 }; // Metal Zone orange
    const Colour kText         { 0xffe0e0e0 };
    const Colour kTextDim      { 0xff909090 };
}

MetalZoneEditor::MetalZoneEditor (MetalZoneProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setupKnob (level,   "level",   "LEVEL");
    setupKnob (dist,    "dist",    "DIST");
    setupKnob (low,     "low",     "LOW");
    setupKnob (mid,     "mid",     "MID");
    setupKnob (midFreq, "midFreq", "MID FREQ");
    setupKnob (high,    "high",    "HIGH");

    setSize (660, 280);
}

void MetalZoneEditor::setupKnob (KnobControl& k, const String& paramID, const String& labelText)
{
    k.slider.setSliderStyle (Slider::RotaryHorizontalVerticalDrag);
    k.slider.setTextBoxStyle (Slider::TextBoxBelow, false, 70, 18);
    k.slider.setColour (Slider::rotarySliderFillColourId, kAccent);
    k.slider.setColour (Slider::rotarySliderOutlineColourId, kPanel);
    k.slider.setColour (Slider::thumbColourId, kText);
    k.slider.setColour (Slider::textBoxTextColourId, kText);
    k.slider.setColour (Slider::textBoxBackgroundColourId, Colours::transparentBlack);
    k.slider.setColour (Slider::textBoxOutlineColourId, Colours::transparentBlack);
    addAndMakeVisible (k.slider);

    k.label.setText (labelText, dontSendNotification);
    k.label.setJustificationType (Justification::centred);
    k.label.setColour (Label::textColourId, kTextDim);
    k.label.setFont (Font (FontOptions (12.0f).withStyle ("Bold")));
    addAndMakeVisible (k.label);

    k.attachment = std::make_unique<SliderAttachment>(processor.apvts, paramID, k.slider);
}

void MetalZoneEditor::paint (Graphics& g)
{
    g.fillAll (kBackground);

    // Title bar
    auto titleArea = getLocalBounds().removeFromTop (44);
    g.setColour (kPanel);
    g.fillRect (titleArea);
    g.setColour (kAccent);
    g.drawRect (titleArea.expanded (0, 1).withTop (titleArea.getBottom() - 2), 2);

    g.setColour (kAccent);
    g.setFont (Font (FontOptions (22.0f).withStyle ("Bold")));
    g.drawText ("METAL ZONE", titleArea.withTrimmedLeft (20), Justification::centredLeft);

    g.setColour (kTextDim);
    g.setFont (Font (FontOptions (10.0f)));
    g.drawText ("MT-style distortion", titleArea.withTrimmedRight (20), Justification::centredRight);
}

void MetalZoneEditor::resized()
{
    auto area = getLocalBounds();
    area.removeFromTop (50); // title bar + gap
    area.removeFromBottom (10);
    area.reduce (10, 0);

    const int numKnobs = 6;
    const int knobW = area.getWidth() / numKnobs;

    KnobControl* knobs[] = { &level, &dist, &low, &mid, &midFreq, &high };

    for (int i = 0; i < numKnobs; ++i)
    {
        auto cell = area.removeFromLeft (knobW);
        auto labelArea = cell.removeFromBottom (18);
        knobs[i]->label.setBounds (labelArea);
        knobs[i]->slider.setBounds (cell.reduced (6, 4));
    }
}
