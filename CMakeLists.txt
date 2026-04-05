cmake_minimum_required(VERSION 3.22)

project(MetalZone VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Fetch JUCE
include(FetchContent)
FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG        8.0.4
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(MetalZone
  COMPANY_NAME              "Homebrew"
  BUNDLE_ID                 "com.homebrew.metalzone"
  PLUGIN_MANUFACTURER_CODE  Hmbr
  PLUGIN_CODE               Mtlz
  FORMATS                   VST3
  PRODUCT_NAME              "MetalZone"
  IS_SYNTH                  FALSE
  NEEDS_MIDI_INPUT          FALSE
  NEEDS_MIDI_OUTPUT         FALSE
  IS_MIDI_EFFECT            FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD   FALSE
  VST3_CATEGORIES           Fx Distortion
)

target_sources(MetalZone PRIVATE
  src/PluginProcessor.cpp
  src/PluginProcessor.h
  src/PluginEditor.cpp
  src/PluginEditor.h
  src/PedalLookAndFeel.h
  src/ConcentricKnob.h
)

# Embed the MT-2 reference image as plugin binary data
juce_add_binary_data(MetalZoneAssets
  SOURCES
    web/assets/mt2-gal.png
)

target_compile_definitions(MetalZone PUBLIC
  JUCE_WEB_BROWSER=0
  JUCE_USE_CURL=0
  JUCE_VST3_CAN_REPLACE_VST2=0
  JUCE_DISPLAY_SPLASH_SCREEN=0
)

target_link_libraries(MetalZone
  PRIVATE
    MetalZoneAssets
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_dsp
    juce::juce_gui_basics
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)
