#include "PluginEditor.h"

using namespace juce;

namespace
{
    // MT-2 pedal palette
    const Colour kBodyOrange   { 0xffe89135 };  // main orange body
    const Colour kBodyShadow   { 0xffb86a1f };  // darker orange for shading
    const Colour kHeaderBlack  { 0xff0a0a0a };
    const Colour kBossSilver   { 0xffe8e8e8 };
    const Colour kText         { 0xff101010 };
    const Colour kTextWhite    { 0xfff0f0f0 };
    const Colour kLedRed       { 0xffff2020 };
    const Colour kChromeLight  { 0xfff0f0f0 };
    const Colour kChromeDark   { 0xff404040 };
    const Colour kScrew        { 0xff707070 };
}

//==============================================================================
MetalZoneEditor::MetalZoneEditor (MetalZoneProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setLookAndFeel (&pedalLnF);

    setupSingleKnob (levelSlider, levelLabel, "level", "LEVEL", levelAttachment);
    setupSingleKnob (distSlider,  distLabel,  "dist",  "DIST",  distAttachment);

    eqHighLow  = std::make_unique<ConcentricKnob>(processor.apvts, "high", "low", "HIGH", "LOW");
    eqMidFreq  = std::make_unique<ConcentricKnob>(processor.apvts, "midFreq", "mid", "MID FREQ", "MIDDLE");
    addAndMakeVisible (*eqHighLow);
    addAndMakeVisible (*eqMidFreq);

    setSize (380, 560);
}

MetalZoneEditor::~MetalZoneEditor()
{
    setLookAndFeel (nullptr);
}

void MetalZoneEditor::setupSingleKnob (Slider& s, Label& l,
                                       const String& paramID,
                                       const String& labelText,
                                       std::unique_ptr<SliderAttachment>& att)
{
    s.setSliderStyle (Slider::RotaryHorizontalVerticalDrag);
    s.setTextBoxStyle (Slider::NoTextBox, false, 0, 0);
    s.setRotaryParameters (MathConstants<float>::pi * 1.2f,
                           MathConstants<float>::pi * 2.8f, true);
    addAndMakeVisible (s);

    l.setText (labelText, dontSendNotification);
    l.setJustificationType (Justification::centred);
    l.setColour (Label::textColourId, kText);
    l.setFont (Font (FontOptions (11.0f).withStyle ("Bold")));
    addAndMakeVisible (l);

    att = std::make_unique<SliderAttachment>(processor.apvts, paramID, s);
}

//==============================================================================
void MetalZoneEditor::paint (Graphics& g)
{
    const auto bounds = getLocalBounds().toFloat();

    // Background (pure black behind pedal — no visible in release)
    g.fillAll (Colours::black);

    // Pedal body with rounded corners
    const float corner = 8.0f;
    auto body = bounds.reduced (6.0f);
    g.setColour (kBodyOrange);
    g.fillRoundedRectangle (body, corner);

    // Top black header band (BOSS logo)
    auto header = body.withHeight (52.0f);
    g.setColour (kHeaderBlack);
    g.fillRoundedRectangle (header, corner);
    // Square off bottom of rounded rect
    g.fillRect (header.withTrimmedTop (corner).withTrimmedBottom (0));
    // BOSS wordmark
    g.setColour (kBossSilver);
    g.setFont (Font (FontOptions (26.0f).withStyle ("Bold")));
    g.drawText ("BOSS", header.reduced (18.0f, 0.0f), Justification::centredLeft);
    g.setColour (Colour (0xff909090));
    g.setFont (Font (FontOptions (9.0f)));
    g.drawText ("COMPACT PEDAL", header.reduced (18.0f, 0.0f), Justification::centredRight);

    // "METAL ZONE" title
    auto titleArea = body.withTop (header.getBottom() + 6.0f).withHeight (40.0f);
    g.setColour (kText);
    g.setFont (Font (FontOptions (26.0f).withStyle ("Bold")));
    g.drawText ("METAL ZONE", titleArea.reduced (18.0f, 0.0f), Justification::centredLeft);
    g.setFont (Font (FontOptions (14.0f).withStyle ("Bold")));
    g.drawText ("MT-2", titleArea.reduced (18.0f, 0.0f), Justification::centredRight);

    // Faint line under title
    g.setColour (kBodyShadow);
    g.drawHorizontalLine (titleArea.getBottom(), body.getX() + 18.0f, body.getRight() - 18.0f);

    // LED area label
    auto ledY = body.getY() + 280.0f;
    g.setColour (kText);
    g.setFont (Font (FontOptions (9.0f).withStyle ("Bold")));
    g.drawText ("CHECK", Rectangle<float>(body.getX() + 18.0f, ledY - 14.0f, 60.0f, 12.0f), Justification::centredLeft);

    // LED circle
    const float ledRadius = 5.0f;
    const float ledCx = body.getX() + 30.0f;
    const float ledCy = ledY + 2.0f;
    // LED bezel
    g.setColour (Colour (0xff202020));
    g.fillEllipse (ledCx - ledRadius - 2.0f, ledCy - ledRadius - 2.0f,
                   (ledRadius + 2.0f) * 2.0f, (ledRadius + 2.0f) * 2.0f);
    // LED glow
    g.setColour (kLedRed);
    g.fillEllipse (ledCx - ledRadius, ledCy - ledRadius, ledRadius * 2.0f, ledRadius * 2.0f);
    g.setColour (Colour (0xffffaaaa));
    g.fillEllipse (ledCx - 1.5f, ledCy - 2.0f, 3.0f, 3.0f);

    // Footswitch (large chrome stomp button) — decorative
    const float fsRadius = 52.0f;
    const float fsCx = body.getCentreX();
    const float fsCy = body.getBottom() - 100.0f;
    // Outer rim
    ColourGradient rimGrad (kChromeLight, fsCx, fsCy - fsRadius,
                            kChromeDark,  fsCx, fsCy + fsRadius, false);
    g.setGradientFill (rimGrad);
    g.fillEllipse (fsCx - fsRadius, fsCy - fsRadius, fsRadius * 2.0f, fsRadius * 2.0f);
    // Inner cap
    const float innerR = fsRadius - 10.0f;
    ColourGradient capGrad (Colour (0xff606060), fsCx, fsCy - innerR,
                            Colour (0xff1a1a1a), fsCx, fsCy + innerR, false);
    g.setGradientFill (capGrad);
    g.fillEllipse (fsCx - innerR, fsCy - innerR, innerR * 2.0f, innerR * 2.0f);
    // Highlight
    g.setColour (Colour (0x55ffffff));
    g.fillEllipse (fsCx - innerR * 0.6f, fsCy - innerR * 0.85f,
                   innerR * 1.2f, innerR * 0.6f);

    // Footer black stripe
    auto footer = body.withY (body.getBottom() - 26.0f).withHeight (26.0f);
    g.setColour (kHeaderBlack);
    g.fillRoundedRectangle (footer, corner);
    g.fillRect (footer.withHeight (corner));
    g.setColour (kBossSilver);
    g.setFont (Font (FontOptions (10.0f).withStyle ("Bold")));
    g.drawText ("METAL ZONE  MT-2", footer, Justification::centred);

    // Corner screws (decorative)
    auto drawScrew = [&] (float cx, float cy)
    {
        const float r = 5.0f;
        g.setColour (Colour (0xff404040));
        g.fillEllipse (cx - r, cy - r, r * 2.0f, r * 2.0f);
        g.setColour (kScrew);
        g.fillEllipse (cx - r + 1.0f, cy - r + 1.0f, (r - 1.0f) * 2.0f, (r - 1.0f) * 2.0f);
        g.setColour (Colour (0xff303030));
        g.drawLine (cx - r + 2.0f, cy, cx + r - 2.0f, cy, 1.2f); // slot
    };
    drawScrew (body.getX() + 14.0f, body.getY() + 66.0f);
    drawScrew (body.getRight() - 14.0f, body.getY() + 66.0f);
    drawScrew (body.getX() + 14.0f, body.getBottom() - 38.0f);
    drawScrew (body.getRight() - 14.0f, body.getBottom() - 38.0f);
}

void MetalZoneEditor::resized()
{
    // Knob row — below title (~y=120), height ~110
    const int knobRowY = 128;
    const int knobRowH = 110;
    const int pad = 14;

    auto area = getLocalBounds().reduced (pad, 0);
    const int colW = area.getWidth() / 4;

    auto makeCol = [&] (int index) {
        return juce::Rectangle<int> (area.getX() + index * colW, knobRowY, colW, knobRowH + 22);
    };

    // Column 0: LEVEL (single)
    {
        auto col = makeCol (0);
        auto labelArea = col.removeFromBottom (22);
        levelLabel.setBounds (labelArea);
        levelSlider.setBounds (col.reduced (6, 4));
    }

    // Column 1: HIGH/LOW concentric
    eqHighLow->setBounds (makeCol (1).reduced (4, 4));

    // Column 2: MID FREQ / MIDDLE concentric
    eqMidFreq->setBounds (makeCol (2).reduced (4, 4));

    // Column 3: DIST (single)
    {
        auto col = makeCol (3);
        auto labelArea = col.removeFromBottom (22);
        distLabel.setBounds (labelArea);
        distSlider.setBounds (col.reduced (6, 4));
    }
}
