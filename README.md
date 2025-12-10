# Content Guard - Safety & Censorship Filter

A browser extension that uses real-time AI analysis, community databases, keyword detection, and **adult site blocking** to filter content.

## Features
- **🤖 AI-Powered Detection**: Real-time video analysis with NSFW.js (TensorFlow.js)
- **📝 Keyword Filtering**: Scans subtitles and captions for user-defined keywords
- **📍 Community Timestamps**: Skips/censors scenes based on community database
- **🚫 Adult Site Blocking**: Blocks access to 35+ known pornographic websites
- **⚙️ Customizable Actions**: Blur, Mute, Skip, or Overlay

## Installation

### 1. Load the Extension
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `censur` folder

### 2. Optional: Enable Real AI Detection
Download these files to `libs/` folder for real AI instead of simulation:
- `tf.min.js`: [TensorFlow.js](https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js)
- `nsfwjs.min.js`: [NSFW.js](https://unpkg.com/nsfwjs@2.4.1/dist/nsfwjs.min.js)
- Model files in `libs/model/`: [Download from NSFW.js repo](https://github.com/infinitered/nsfwjs)

## Usage
1. Click the shield icon to open settings
2. Toggle features on/off:
   - **AI Detection** - Real-time video analysis
   - **Keywords** - Text-based detection
   - **Community Database** - Timestamp-based censorship
   - **🚫 Site Blocking** - Block adult websites
3. Adjust sensitivity and default action
4. Save changes

## Site Blocking
When enabled, the extension automatically blocks access to 35+ known pornographic websites and shows a "blocked" page. Edit `blocklist.json` to customize.

## Disclaimer
- User assumes full responsibility for usage
- AI detection is not 100% accurate
- Use in accordance with platform Terms of Service
