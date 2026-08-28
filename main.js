/*
 * Active Settings Viewer for Aerophone Brisa
 * 
 * 1. About "Active Settings"
 *  For parameters that exist in both System and Tone settings, this tool determines 
 *  and displays the currently active setting based on the conditions in the reference manual.
 * 
 *  <Transpose>
 *    Displays either System:Transpose or Temporary Tone:Tone Transpose depending on System:Transpose Source (System/Tone).
 *  <Effect Type>
 *    Displays either Setup:Effect Type or Temporary Tone:Effect Type depending on Setup:Effect Type.
 *  <Effect Level>
 *    Displays either Setup:Effect Level or Temporary Tone:Effect Level depending on Setup:Effect Type.
 *  <Assign Settings>
 *    Displays either System or Tone settings depending on the respective Assign Source settings 
 *    (S1/S2/Thumb/Breath/Motion Tilt/Motion Roll) in System Common.
 * 
 * 2. Discrepancies with MIDI Implementation
 * 
 *  a) The addresses for Motion Roll Assign and Motion Tilt Assign are swapped compared to the official specs.
 * 
 * [Tone]
 * +---------------------------------------------+
 * | Offset   |                                  |
 * | Address  |            Description           |
 * |----------+----------------------------------|
 * | 00 00 00 | Tone Common.       [Tone Common] |
 * |----------+----------------------------------|
 * | 00 01 00 | S1 Assign              [Assign2] |
 * | 00 02 00 | S2 Assign              [Assign2] |
 * | 00 03 00 | Thumb Assign           [Assign2] |
 * |----------+----------------------------------|
 * | 00 04 00 | Breath Assign          [Assign8] |
 * |----------+----------------------------------|
 * | 00 08 00 | Motion Roll Assign     [Assign4] |
 * | 00 09 00 | Motion Tilt Assign     [Assign4] |
 * |----------+----------------------------------|
 * | 00 30 00 | Tone Part            [Tone Part] |
 * +---------------------------------------------+
 * 
 * [System]
 * +---------------------------------------------+
 * | Offset   |                                  |
 * | Address  |            Description           |
 * |----------+----------------------------------|
 * | 00 00 00 | System Common    [System Common] |
 * |----------+----------------------------------|
 * | 00 02 00 | S1 Assign              [Assign2] |
 * | 00 03 00 | S2 Assign              [Assign2] |
 * | 00 04 00 | Thumb Assign           [Assign2] |
 * |----------+----------------------------------|
 * | 00 15 00 | Breath Assign          [Assign8] |
 * |----------+----------------------------------|
 * | 00 17 00 | Motion Roll Assign     [Assign4] |
 * | 00 18 00 | Motion Tilt Assign     [Assign4] |
 * |----------+----------------------------------|
 * |  ...     | ...                              |
 * 
 * b) Effect Type and Effect Level, which presumably should be in the System area, 
 *    are strangely stored in the Setup area and are undocumented in the specs.
 * 
 * [Setup]
 * +--------------------------------------------------------------------+
 * | Offset      |           |                                          |
 * |     Address |           |      Description                         |
 * |-------------+-----------+------------------------------------------|
 * |       ...   | ...       | ...                                      |
 * |       00 04 | 0000 aaaa | Favorite Number                 (0 - 11) |
 * |       00 05 | 0000 0000 | (Reserved / Unknown)                 (0) |
 * |       00 06 | 000a aaaa | Effect Type                     (0 - 18) |
 * |       00 07 | 0aaa aaaa | Effect Level                   (0 - 127) |
 * |       00 08 | 0aaa aaaa | Version Char 1   (ASCII)                 |
 * |       00 09 | 0aaa aaaa | Version Char 2   (ASCII)                 |
 * |       00 0A | 0aaa aaaa | Version Char 3   (ASCII)                 |
 * |       00 0B | 0aaa aaaa | Version Char 4   (ASCII)                 |
 * |-------------+-----------+------------------------------------------|
 * | 00 00 00 0C |Total Size                                            |
 * +--------------------------------------------------------------------+
*/

// Object to manage application state
const appState = {
    setup: null,
    systemCommon: null,
    toneCommon: null,
    tonePart: null,
    assigns: {}
};

// Define tone name dictionary
const presetToneDictionary = {
    "85-64-0": "Concert Flute", "85-64-1": "Jazz Flute", "85-64-2": "Jazz Flute Atk",
    "85-64-3": "Pop Flute", "85-64-4": "Piccolo", "85-64-5": "Alto Flute",
    "85-64-6": "Bass Flute", "85-64-7": "Soprano Recorder", "85-64-8": "Alto Recorder",
    "85-64-9": "Ocarina", "85-64-10": "Alto Sax", "85-64-11": "Tenor Sax",
    "85-64-12": "Soprano Sax", "85-64-13": "Baritone Sax", "85-64-14": "Clarinet",
    "85-64-15": "Oboe", "85-64-16": "English Horn", "85-64-17": "Bassoon",
    "85-64-18": "Harmonica 1", "85-64-19": "Harmonica 2", "85-64-20": "Whistle",
    "85-64-21": "Trumpet", "85-64-22": "Mute Trumpet", "85-64-23": "Cornet",
    "85-64-24": "Trombone", "85-64-25": "French Horn", "85-64-26": "Tuba",
    "85-64-27": "Brass Section", "85-64-28": "Violin", "85-64-29": "Cello",
    "85-64-30": "Contrabass", "85-64-31": "Contrabass Pizz", "85-64-32": "Strings",
    "85-64-33": "Pan Flute", "85-64-34": "Zampona", "85-64-35": "Tin Whistle",
    "85-64-36": "Ryuteki", "85-64-37": "Shinobue", "85-64-38": "Shakuhachi 1",
    "85-64-39": "Shakuhachi 2", "85-64-40": "Bansuri", "85-64-41": "Shehnai",
    "85-64-42": "Pungi", "85-64-43": "Uilleann Pipes", "85-64-44": "Bag Pipes",
    "85-64-45": "Duduk 1", "85-64-46": "Duduk 2", "85-64-47": "Qudi",
    "85-64-48": "Bangdi", "85-64-49": "Bawu", "85-64-50": "Xiao",
    "85-64-51": "Xun", "85-64-52": "Guanzi", "85-64-53": "Suona",
    "85-64-54": "Hulusi", "85-64-55": "Sheng", "85-64-56": "Erhu",
    "85-64-57": "Matouqin", "85-64-58": "Synth Recorder", "85-64-59": "Lyrical SoftLead",
    "85-64-60": "Simple Sqr Lead", "85-64-61": "Simple Tri Lead", "85-64-62": "Tri Atk Lead",
    "85-64-63": "Sqr Fl Lead", "85-64-64": "Wide Syn Flute", "85-64-65": "Lyrical Sqr Lead",
    "85-64-66": "Warm Saw Lead", "85-64-67": "Lyrical SawLead1", "85-64-68": "Lyrical SawLead2",
    "85-64-69": "Lyrical SawLead3", "85-64-70": "Bright Saw Lead", "85-64-71": "SawSqr Reso Lead",
    "85-64-72": "Dist Saw Lead", "85-64-73": "Voice Lead", "85-64-74": "Porta Sqr Lead",
    "85-64-75": "Pulse Lead", "85-64-76": "Tri Sqr Lead", "85-64-77": "Saw Tp Lead",
    "85-64-78": "Syn MtTp Lead", "85-64-79": "La Seine", "85-64-80": "Musette",
    "85-64-81": "Jazz Organ", "85-64-82": "Rock Organ", "85-64-83": "Church Organ",
    "85-64-84": "Jazz Scat 1", "85-64-85": "Jazz Scat 2", "85-64-86": "Choir",
    "85-64-87": "Timpani", "85-64-88": "Steel Drums", "85-64-89": "Vibraphone",
    "85-64-90": "Marimba", "85-64-91": "Xylophone", "85-64-92": "Glockenspiel",
    "85-64-93": "Glocken Pad", "85-64-94": "Drum Kit 1", "85-64-95": "Drum Kit 2",
    "85-64-96": "Latin Perc Set", "85-64-97": "SFX 1", "85-64-98": "SFX 2",
    "85-64-99": "Didgeridoo"
};

// Dictionaries for converting values to meaningful strings
const transposeMap = {
    59: "G (-5)", 60: "G# (-4)", 61: "A (-3)", 62: "Bb (-2)", 63: "B (-1)",
    64: "C (0)", 65: "C# (+1)", 66: "D (+2)", 67: "Eb (+3)", 68: "E (+4)",
    69: "F (+5)", 70: "F# (+6)"
};
const intelHarmonyMap = [
    "Off", "Oct below", "7th below", "6th below", "5th below",
    "4th below", "3rd below", "2nd below", "2nd above", "3rd above",
    "4th above", "5th above", "6th above", "7th above", "Oct above"
];

// ----- Dictionaries for Assign parameters -----
const assignFunctionList = [
    "Off", "CC 01", "Breath", "Breath Sub", "Articulation",
    "Portamento Time", "CC 06", "Volume", "CC 08", "CC 09", "Pan",
    "Expression", "CC 12", "CC 13", "CC 14", "CC 15", "CC 16",
    "CC 17", "CC 18", "CC 19", "CC 20", "CC 21", "CC 22", "CC 23",
    "CC 24", "CC 25", "CC 26", "CC 27", "CC 28", "CC 29", "CC 30",
    "CC 31", "CC 33", "CC 34", "CC 35", "CC 36", "CC 37", "CC 38",
    "CC 39", "CC 40", "CC 41", "CC 42", "CC 43", "CC 44", "CC 45",
    "CC 46", "CC 47", "CC 48", "CC 49", "CC 50", "CC 51", "CC 52",
    "CC 53", "CC 54", "CC 55", "CC 56", "CC 57", "CC 58", "CC 59",
    "CC 60", "CC 61", "CC 62", "CC 63", "CC 64", "CC 65", "CC 66",
    "CC 67", "CC 68", "CC 69", "CC 70", "Resonance", "Release",
    "Attack", "Cutoff", "Decay", "Vibrato Rate", "Vibrato Depth",
    "Vibrato Delay", "CC 79", "CC 80", "CC 81", "CC 82", "CC 83",
    "CC 84", "CC 85", "CC 86", "CC 87", "CC 88", "CC 89", "CC 90",
    "CC 91", "CC 92", "CC 93", "CC 94", "CC 95", "Bend Down",
    "Bend Up", "After Touch", "Oct -1", "Oct +1", "Tone Down",
    "Tone Up", "Favorite Down", "Favorite Up", "Favorite Bank Down",
    "Favorite Bank Up", "IFX Sw", "Oct Down", "Oct Up", "Transpose Down",
    "Transpose Up", "Harmony/Drone Sw", "Hold Mode Sw", "Harmony Scale",
    "Harmony Key"
];
const modeList = ["Latch", "Momentary"];
const curveList = [
    "1 Linear", "2 Exp L", "3 Exp M1", "4 Exp M2", "5 Exp H",
    "6 Log L", "7 Log M1", "8 Log M2", "9 Log H", "10 S-Shape",
    "11 Reverse S", "12 Step"
];

// --- System Common Dictionaries ---
const autoDisplayOffMap = ["Always On", "3sec", "10sec", "30sec", "1min", "2min", "3min"];
const autoPowerOffMap = ["Always On", "5min", "20min"];
const menuStartupMap = ["Easy Menu", "Pro Menu"];
const onOffMap = ["Off", "On"];
const phonesMonoStereoMap = ["Stereo", "Mono"];
const speakerOutMap = ["Off", "On", "Auto Mute"];
const transposeSourceMap = ["System", "Tone"];
const fingeringModeMap = ["Brisa", "Flute", "Trumpet", "Left", "Right"];
const octaveModeMap = ["Oct-A", "Oct-B"];
const assignSourceMap = ["OFF", "System", "Tone"];
const motionModeMap = ["Normal", "Vibrato"];
const harmonicsCenterMap = ["Lower 5", "Lower 4", "Lower 3", "Lower 2", "Lower 1", "Mid", "Upper 1", "Upper 2", "Upper 3", "Upper 4", "Upper 5"];
const harmonicsPolarityMap = ["Natural", "Reverse"];

// --- Tone Common Effect Type Dictionary ---
const effectTypeMap = [
    "Off",
    "Reverb Hall 1", "Reverb Hall 2", "Reverb Hall 3", "Reverb Hall 4",
    "Reverb Room 1", "Reverb Room 2", "Reverb Plate 1", "Reverb Plate 2", "Reverb Plate 3",
    "Delay 1", "Delay 2", "Delay 3", "Delay 4", "Delay 5", "Delay 6", "Delay 7",
    "Chorus"
];

// --- Definition list for common Assign processing ---
const assignDefs = [
    { id: "s1", name: "S1 Assign", chkId: "chkS1", reqSize: 0x0E, sysSourceOffset: 0x30, sysAddr: 0x02, toneAddr: 0x01, areaElement: () => s1AssignArea },
    { id: "s2", name: "S2 Assign", chkId: "chkS2", reqSize: 0x0E, sysSourceOffset: 0x31, sysAddr: 0x03, toneAddr: 0x02, areaElement: () => s2AssignArea },
    { id: "thumb", name: "Thumb Assign", chkId: "chkThumb", reqSize: 0x0E, sysSourceOffset: 0x32, sysAddr: 0x04, toneAddr: 0x03, areaElement: () => thumbAssignArea },
    { id: "breath", name: "Breath Assign", chkId: "chkBreath", reqSize: 0x38, sysSourceOffset: 0x33, sysAddr: 0x15, toneAddr: 0x04, areaElement: () => breathAssignArea },
    { id: "motionRoll", name: "Motion Roll Assign", chkId: "chkMotionRoll", reqSize: 0x1C, sysSourceOffset: 0x35, sysAddr: 0x17, toneAddr: 0x08, areaElement: () => motionRollAssignArea },
    { id: "motionTilt", name: "Motion Tilt Assign", chkId: "chkMotionTilt", reqSize: 0x1C, sysSourceOffset: 0x36, sysAddr: 0x18, toneAddr: 0x09, areaElement: () => motionTiltAssignArea }
];

// Get display areas and buttons
const statusMessage = document.getElementById("statusMessage");
const setupArea = document.getElementById("setupArea");
const toneCommonArea = document.getElementById("toneCommonArea");
const s1AssignArea = document.getElementById("s1AssignArea");
const s2AssignArea = document.getElementById("s2AssignArea");
const thumbAssignArea = document.getElementById("thumbAssignArea");
const breathAssignArea = document.getElementById("breathAssignArea");
const motionTiltAssignArea = document.getElementById("motionTiltAssignArea");
const motionRollAssignArea = document.getElementById("motionRollAssignArea");
const tonePartArea = document.getElementById("tonePartArea");

const readSelectedButton = document.getElementById("readSelectedButton");
const toneDownButton = document.getElementById("toneDownButton");
const toneUpButton = document.getElementById("toneUpButton");

// Generate select box
const toneSelect = document.getElementById("toneSelect");

// --- Start: Active Settings ---
let activeOption = document.createElement("option");
activeOption.value = "active,0"; // Special value for evaluation
activeOption.text = "Active Settings";
activeOption.selected = true;
toneSelect.appendChild(activeOption);
// --- End: Active Settings ---

// Add System Settings
let sysOption = document.createElement("option");
sysOption.value = "0,0";
sysOption.text = "System Settings";
toneSelect.appendChild(sysOption);

// Add Preset Tones (001 - 100) using the dictionary
for (let pc = 0; pc <= 99; pc++) {
    let index = pc; // PC 0 is the 1st preset (Address 40 00)
    let addrMsb = 0x40 + Math.floor(index / 128);
    let addrLsb = index % 128;

    // Retrieve tone name from dictionary
    let toneKey = `85-64-${pc}`;
    let toneName = presetToneDictionary[toneKey] || "Unknown Tone";

    let option = document.createElement("option");
    option.value = `${addrMsb},${addrLsb}`;
    // Display number and tone name together
    option.text = `Preset ${(pc + 1).toString().padStart(3, '0')}: ${toneName}`;
    toneSelect.appendChild(option);
}
// Add User Tones (001 - 048)
// Address: 50 00 00 00 to 50 7F 00 00 (Up to 50 2F according to specs)
for (let i = 1; i <= 48; i++) {
    let index = i - 1;
    let msb = 0x50 + Math.floor(index / 128);
    let lsb = index % 128;
    let option = document.createElement("option");
    option.value = `${msb},${lsb}`;
    option.text = `User Tone (${i.toString().padStart(3, '0')})`;
    toneSelect.appendChild(option);
}

// Helper function to get the selected base address
function getTargetBaseAddress() {
    const vals = toneSelect.value.split(",");
    return [parseInt(vals[0], 10), parseInt(vals[1], 10)];
}
// ----------------------------------------
// Temporary variables for Transpose
let tempSysTransposeSource = null;
let tempSysTranspose = null;
let tempToneTranspose = null;

// Temporary variables for Effects
let tempSysEffectType = null;
let tempSysEffectLevel = null;
let tempToneEffectType = null;
let tempToneEffectLevel = null;

function clearActiveSettingsData() {
    tempSysTransposeSource = null;
    tempSysTranspose = null;
    tempToneTranspose = null;

    tempSysEffectType = null;
    tempSysEffectLevel = null;
    tempToneEffectType = null;
    tempToneEffectLevel = null;

    // appStateの初期化（Assignの枠もここで作ります）
    appState.setup = null;
    appState.toneCommon = null;
    appState.systemCommon = null;
    appState.tonePart = null;
    
    assignDefs.forEach(def => {
        appState.assigns[def.id] = { source: null, sysData: null, toneData: null };
    });

    const area = document.getElementById("activeSettingsArea");
    if (area) area.innerHTML = "";
}

function updateActiveSettings() {
    const area = document.getElementById("activeSettingsArea");
    if (!area) return;

    // Wait to render if required data (both System and Tone) is not ready
    if (tempSysTransposeSource === null || tempSysTranspose === null || tempToneTranspose === null ||
        tempSysEffectType === null || tempSysEffectLevel === null || tempToneEffectType === null || tempToneEffectLevel === null) {
        return;
    }

    // --- Transpose Application Logic ---
    let activeTrans, transSourceName;
    if (tempSysTransposeSource === 0) { // System priority
        activeTrans = tempSysTranspose;
        transSourceName = "System";
    } else { // Tone priority
        activeTrans = tempToneTranspose;
        transSourceName = "Tone";
    }
    const transText = transposeMap[activeTrans] || activeTrans;

    // --- Effect Application Logic ---
    let activeEffType, activeEffLevel, effSourceName;

    // System side raw data: 0=Off, 1=<Tone>, 2=Reverb Hall 1 ... 18=Chorus
    if (tempSysEffectType === 1) {
        // If System specifies <Tone>, apply Tone Common value
        activeEffType = effectTypeMap[tempToneEffectType] || `Type ${tempToneEffectType}`;
        activeEffLevel = tempToneEffectLevel;
        effSourceName = "Tone";
    } else {
        // If effect is overridden on the System side
        let typeIndex = tempSysEffectType;
        if (typeIndex > 1) typeIndex -= 1; // Adjust to match dictionary index

        activeEffType = effectTypeMap[typeIndex] || `Type ${tempSysEffectType}`;
        activeEffLevel = tempSysEffectLevel;
        effSourceName = "System";
    }

    // --- Assign (6 types) Application Logic ---
    let assignRowsHtml = "";
    assignDefs.forEach(def => {
        // Do not display if unchecked
        if (!document.getElementById(def.chkId).checked) return;

        const state = appState.assigns[def.id];
        let activeText = "Waiting for data...";
        let sourceName = "-";

        // OK if only the one specified by "Source" is ready, not necessarily both System and Tone
        if (state.source !== null) {
            let targetData = null;
            let isReady = false;

            if (state.source === 0) {
                activeText = "OFF (Disabled)";
                sourceName = "System (OFF)";
                isReady = true;
            } else if (state.source === 1 && state.sysData) {
                targetData = state.sysData;
                sourceName = "System";
                isReady = true;
            } else if (state.source === 2 && state.toneData) {
                targetData = state.toneData;
                sourceName = "Tone";
                isReady = true;
            }

            if (isReady && targetData) {
                let funcs = [];
                // Automatically calculate loop count from array length (supports mixed sizes!)
                const setCount = targetData.length / 7;
                for (let i = 0; i < setCount; i++) {
                    const funcVal = targetData[i * 7];
                    funcs.push(`[${i + 1}] ${assignFunctionList[funcVal] || funcVal}`);
                }
                activeText = funcs.join("<br>"); // Line break and list
            }
        }

        // Add HTML for one row
        assignRowsHtml += `<tr><td>${def.name}</td><td>${activeText}</td><td>${sourceName}</td></tr>`;
    });

    // Output HTML
    area.innerHTML = `
        <h3>Active Settings</h3>
        <table>
            <tr><th>Parameter</th><th>Value</th><th>Source</th></tr>
            <tr><td>Transpose</td><td>${transText}</td><td>${transSourceName}</td></tr>
            <tr><td>Effect Type</td><td>${activeEffType}</td><td>${effSourceName}</td></tr>
            <tr><td>Effect Level</td><td>${activeEffLevel}</td><td>${effSourceName}</td></tr>
            ${assignRowsHtml}
        </table>
    `;
}
// ----------------------------------------

// Current tone state
let currentMsb = 85;
let currentLsb = 64;
let currentPc = 0;

// Calculate checksum
function calculateChecksum(bytes) {
    let sum = 0;
    for (let i = 0; i < bytes.length; i++) {
        sum += bytes[i];
    }
    return (128 - (sum % 128)) % 128;
}

// Data transmission process
function sendRq1(output, addressAndSize) {
    const checksum = calculateChecksum(addressAndSize);
    const setupRq1 = new Uint8Array([
        0xF0, 0x41, 0x10, 0x01, 0x06, 0x08, 0x11,
        ...addressAndSize,
        checksum,
        0xF7
    ]);
    output.send(setupRq1);
    statusMessage.innerHTML = "Waiting for device response...";
}

document.getElementById('connectButton').addEventListener('click', () => {
    navigator.requestMIDIAccess({ sysex: true })
        .then(onMIDISuccess)
        .catch(onMIDIFailure);
});

function onMIDIFailure() {
    statusMessage.innerHTML = "<span style='color:red;'>Error: MIDI access denied.</span>";
}

function onMIDISuccess(midiAccess) {
    const inputs = Array.from(midiAccess.inputs.values());
    const outputs = Array.from(midiAccess.outputs.values());


    const input = inputs.find(p => p.name.includes('AE-BRISA')) || inputs[0];
    const output = outputs.find(p => p.name.includes('AE-BRISA')) || outputs[0];

    if (!input || !output) {
        statusMessage.innerHTML = "<span style='color:red;'>Error: MIDI device not found.</span>";
        return;
    }

    console.log("Input:", input.name);
    console.log("Output:", output.name);

    statusMessage.innerHTML = "Connected to MIDI device. Please select an option and click Read.";
    readSelectedButton.disabled = false;
    toneDownButton.disabled = false;
    toneUpButton.disabled = false;

    // Global transmission queue management (for 2-step requests)
    let globalRequestQueue = [];
    let isSendingRequests = false;

    function enqueueRequests(reqs) {
        globalRequestQueue.push(...reqs);
        if (!isSendingRequests) sendNextGlobalRequest();
    }

    function sendNextGlobalRequest() {
        if (globalRequestQueue.length > 0) {
            isSendingRequests = true;
            const req = globalRequestQueue.shift();
            sendRq1(output, req);
            setTimeout(sendNextGlobalRequest, 50);
        } else {
            isSendingRequests = false;
        }
    }

    // --- Common Assign Rendering Function ---
    function renderAssignData(assignName, targetArea, assignData) {
        if (!targetArea) return;

        statusMessage.innerHTML = `${assignName} data read successfully!`;
        const setCount = assignData.length / 7;
        let html = `<h3>${assignName} Settings</h3>`;

        for (let i = 0; i < setCount; i++) {
            const offset = i * 7;
            const funcVal = assignData[offset + 0];
            const inMin = assignData[offset + 1];
            const inMax = assignData[offset + 2];
            const outMin = assignData[offset + 3];
            const outMax = assignData[offset + 4];
            const modeVal = assignData[offset + 5];
            const curveVal = assignData[offset + 6];

            html += `
            <h4>Assign ${i + 1}</h4>
            <table>
                  <tr><th>Parameter</th><th>Value</th></tr>
                <tr><td>Function</td><td>${assignFunctionList[funcVal] || funcVal}</td></tr>
                <tr><td>Input Min</td><td>${inMin}</td></tr>
                <tr><td>Input Max</td><td>${inMax}</td></tr>
                <tr><td>Output Min</td><td>${outMin}</td></tr>
                <tr><td>Output Max</td><td>${outMax}</td></tr>
                <tr><td>Mode</td><td>${modeList[modeVal] || modeVal}</td></tr>
                <tr><td>Curve</td><td>${curveList[curveVal] || curveVal}</td></tr>
            </table>
        `;
        }
        targetArea.innerHTML = html;
    }
    // Message reception processing
    input.onmidimessage = (event) => {
        const data = event.data;

        // Debug log (Commented out for production to prevent console spam)
        // if (data[0] !== 254) { console.log("Received Data:", data); }

        // When SysEx(F0) and DT1(12H) messages are received
        if (data[0] === 0xF0 && data[6] === 0x12) {

            // Type judgment by address
            const isSystemData = (data[7] === 0x00 && data[8] === 0x00);
            const isSetupData = (data[7] === 0x00 && data[8] === 0x10);
            const isToneData = (data[7] === 0x01 || (data[7] >= 0x40 && data[7] <= 0x43) || data[7] === 0x50);

            // ==========================================
            // Setup Area Processing
            // ==========================================
            if (isSetupData && data[9] === 0x00 && data[10] === 0x00) {
                statusMessage.innerHTML = "Setup data read successfully!";

                // 1. Extract data
                const toneBsMsb = data[11];
                const toneBsLsb = data[12];
                const tonePc = data[13];
                const favBank = data[14];
                const favNumber = data[15];
                const sysEffectTypeRaw = data[11 + 0x06];
                const sysEffectLevel = data[11 + 0x07];

                // Save acquired values to global variables as a starting point for Tone Up/Down
                currentMsb = toneBsMsb;
                currentLsb = toneBsLsb;
                currentPc = tonePc;

                // 2. Store extracted data into appState
                appState.setup = {
                    toneBsMsb: toneBsMsb,
                    toneBsLsb: toneBsLsb,
                    tonePc: tonePc,
                    favBank: favBank,
                    favNumber: favNumber,
                    sysEffectTypeRaw: sysEffectTypeRaw,
                    sysEffectLevel: sysEffectLevel
                };

                // (Existing process) Update variables for Active Settings
                tempSysEffectType = sysEffectTypeRaw;
                tempSysEffectLevel = sysEffectLevel;

                // 3. Call the separated rendering function
                renderSetup();
                
                updateActiveSettings();
            }

            // ==========================================
            // System Area Processing
            // ==========================================
            else if (isSystemData) {
                // System Common (Address 00 00 00)
                if (data[9] === 0x00 && data[10] === 0x00) {
                    statusMessage.innerHTML = "System Common data read successfully!";

                    // 1. Extract the raw payload data (excluding header, checksum, EOX)
                    // (Address offset starts at index 11)
                    const payload = Array.from(data.slice(11, data.length - 2));

                    // 2. Store raw payload into appState
                    appState.systemCommon = {
                        payload: payload
                    };

                    // (Existing process) Process to update currently active settings
                    tempSysTransposeSource = data[11 + 0x0E];
                    tempSysTranspose = data[11 + 0x0F];

                    // Second stage request logic
                    const isToneSelectActive = document.getElementById("toneSelect").value.startsWith("active");
                    let activeAssignRequests = [];

                    assignDefs.forEach(def => {
                        const sourceVal = payload[def.sysSourceOffset];
                        appState.assigns[def.id].source = sourceVal; // assignStatesから変更

                        // In Active Settings mode, request only "necessary data" additionally based on the evaluation result
                        if (isToneSelectActive && document.getElementById(def.chkId).checked) {
                            if (sourceVal === 1) {
                                activeAssignRequests.push([0x00, 0x00, def.sysAddr, 0x00, 0x00, 0x00, 0x00, def.reqSize]);
                            } else if (sourceVal === 2) {
                                activeAssignRequests.push([0x01, 0x00, def.toneAddr, 0x00, 0x00, 0x00, 0x00, def.reqSize]);
                            }
                        }
                    });

                    // Enqueue if there are additional requests
                    if (activeAssignRequests.length > 0) {
                        enqueueRequests(activeAssignRequests);
                    }
                    // 3. Call the separated rendering function
                    renderSystemCommon();

                    updateActiveSettings();
                }

                // System side assign data reception processing
                if (data[10] === 0x00 && data[9] !== 0x00) {
                    const assignData = Array.from(data.slice(11, data.length - 2));
                    assignDefs.forEach(def => {
                        if (data[9] === def.sysAddr) {
                            appState.assigns[def.id].sysData = assignData;
                            renderAssignArea(def.id, "System"); // 専用の描画関数を呼ぶ
                            updateActiveSettings();
                        }
                    });
                }
            }

            // ==========================================
            // Tone Area Processing
            // ==========================================
            else if (isToneData) {
                // Tone Common
                if (data[9] === 0x00 && data[10] === 0x00) {
                    statusMessage.innerHTML = "Tone Common data read successfully!";

                    // 1. Decode 16-character tone name (from ASCII to string)
                    let nameStr = "";
                    for (let i = 0; i < 16; i++) {
                        nameStr += String.fromCharCode(data[11 + i]);
                    }

                    // 2. Extract parameters according to specs (11 is the offset for data start position)
                    const harmonyDrone = data[11 + 0x12];
                    const toneLevel = data[11 + 0x14];
                    const effectType = data[11 + 0x15];
                    const effectLevel = data[11 + 0x16];
                    const toneTranspose = data[11 + 0x17];
                    const octaveShift = data[11 + 0x18];
                    const intelHarmony = data[11 + 0x1C];

                    // 3. Store data into appState
                    appState.toneCommon = {
                        nameStr: nameStr,
                        harmonyDrone: harmonyDrone,
                        toneLevel: toneLevel,
                        effectType: effectType,
                        effectLevel: effectLevel,
                        toneTranspose: toneTranspose,
                        octaveShift: octaveShift,
                        intelHarmony: intelHarmony
                    };

                    // Update variables for Active Settings
                    tempToneTranspose = toneTranspose;
                    tempToneEffectType = effectType;
                    tempToneEffectLevel = effectLevel;

                    // 4. Call the rendering function
                    renderToneCommon();
                    
                    updateActiveSettings();
                }

                // Common Assign processing (S1:01, S2:02, Thumb:03, Breath:04, Motion Tilt:08)
                else if (((data[9] >= 0x01 && data[9] <= 0x04) || data[9] === 0x08 || data[9] === 0x09) && data[10] === 0x00) {
                    const assignData = Array.from(data.slice(11, data.length - 2));

                    assignDefs.forEach(def => {
                        if (data[9] === def.toneAddr) {
                            appState.assigns[def.id].toneData = assignData;
                            renderAssignArea(def.id, "Tone");
                            updateActiveSettings();
                        }
                    });
                }

                // Tone Part reception processing (when address is 00 30 00)
                else if (data[9] === 0x30 && data[10] === 0x00) {
                    statusMessage.innerHTML = "Tone Part data read successfully!";

                    // 1. Extract each parameter
                    const partLevel = data[11 + 0x05];
                    const partPan = data[11 + 0x07];
                    const partCoarseTune = data[11 + 0x08];
                    const partFineTune = data[11 + 0x09];

                    // Portamento Switch (0=OFF, 1=ON, 2=TONE)
                    const portaSw = data[11 + 0x0C];

                    // Portamento Time (Nibble data: Combine upper 4 bits and lower 4 bits)
                    const portaTime = (data[11 + 0x0D] << 4) + data[11 + 0x0E];

                    // Offset value (-64 to +63) processing
                    const cutoff = data[11 + 0x10] - 64;
                    const reso = data[11 + 0x11] - 64;
                    const attack = data[11 + 0x12] - 64;
                    const decay = data[11 + 0x13] - 64;
                    const release = data[11 + 0x14] - 64;
                    const vibRate = data[11 + 0x15] - 64;
                    const vibDepth = data[11 + 0x16] - 64;
                    const vibDelay = data[11 + 0x17] - 64;

                    // Effect send
                    const chorus = data[11 + 0x22];
                    const reverb = data[11 + 0x23];
                    const delay = data[11 + 0x28];

                    // 2. Store extracted data into appState
                    appState.tonePart = {
                        partLevel: partLevel,
                        partPan: partPan,
                        partCoarseTune: partCoarseTune,
                        partFineTune: partFineTune,
                        portaSw: portaSw,
                        portaTime: portaTime,
                        cutoff: cutoff,
                        reso: reso,
                        attack: attack,
                        decay: decay,
                        release: release,
                        vibRate: vibRate,
                        vibDepth: vibDepth,
                        vibDelay: vibDelay,
                        chorus: chorus,
                        reverb: reverb,
                        delay: delay
                    };

                    // 3. Call the separated rendering function
                    renderTonePart();
                }
            }
        }
    };

    // Function for Tone change
    function changeToneAndRefresh() {
        // Add: Force select box to "Temporary Tone"
        toneSelect.selectedIndex = 0;

        // 1. Send channel messages (CC0, CC32, PC) *Using MIDI channel 1 (0x00)
        output.send([0xB0, 0x00, currentMsb]); // Bank Select MSB
        output.send([0xB0, 0x20, currentLsb]); // Bank Select LSB
        output.send([0xC0, currentPc]);        // Program Change

        // Clear each display area
        toneCommonArea.innerHTML = "";
        s1AssignArea.innerHTML = "";
        s2AssignArea.innerHTML = "";
        thumbAssignArea.innerHTML = "";
        breathAssignArea.innerHTML = "";
        motionTiltAssignArea.innerHTML = "";
        motionRollAssignArea.innerHTML = "";
        tonePartArea.innerHTML = "";

        statusMessage.innerHTML = "Tone changed. Reading data...";

        // 3. Wait for device switching process before reading Setup
        setTimeout(() => { readSelectedButton.click(); }, 50);
    }

    // --- Button Event Listeners ---
    toneDownButton.addEventListener('click', () => {
        if (currentPc > 0) { currentPc--; changeToneAndRefresh(); }
    });

    toneUpButton.addEventListener('click', () => {
        if (currentPc < 127) { currentPc++; changeToneAndRefresh(); }
    });

    readSelectedButton.addEventListener('click', () => {
        clearActiveSettingsData();
        setupArea.innerHTML = "";
        if (document.getElementById("systemCommonArea")) document.getElementById("systemCommonArea").innerHTML = "";

        toneCommonArea.innerHTML = "";
        s1AssignArea.innerHTML = "";
        s2AssignArea.innerHTML = "";
        thumbAssignArea.innerHTML = "";
        breathAssignArea.innerHTML = "";
        motionTiltAssignArea.innerHTML = "";
        motionRollAssignArea.innerHTML = "";
        tonePartArea.innerHTML = "";

        const vals = toneSelect.value.split(",");
        const msb = vals[0] === "active" ? "active" : parseInt(vals[0], 10);
        const lsb = parseInt(vals[1], 10);

        let initialRequests = [];

        // When Active, request the 3 base data sets independently of the UI "Common checkbox"
        if (msb === "active") {
            // In the first stage, request "only" these 3 basics.
            // Assigns are dynamically requested after receiving SystemCommon.
            initialRequests.push([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x67]); // System Common
            initialRequests.push([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1D]); // Tone Common
            initialRequests.push([0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10]); // Setup
            
            // Add request for Tone Part if checked
            if (document.getElementById("chkTonePart").checked) {
                initialRequests.push([0x01, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x29]); 
            }
        } else {
            if (document.getElementById("chkCommon").checked) {
                if (msb === 0x00) {
                    initialRequests.push([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x67]);
                } else {
                    initialRequests.push([msb, lsb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1D]);
                }
            }

            if (msb === 0x00) {
                assignDefs.forEach(def => {
                    if (document.getElementById(def.chkId).checked) {
                        initialRequests.push([0x00, 0x00, def.sysAddr, 0x00, 0x00, 0x00, 0x00, def.reqSize]);
                    }
                });
            } else {
                if (msb === 0x01 && document.getElementById("chkSetup").checked) {
                    initialRequests.push([0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10]);
                }
                assignDefs.forEach(def => {
                    if (document.getElementById(def.chkId).checked) {
                        initialRequests.push([msb, lsb, def.toneAddr, 0x00, 0x00, 0x00, 0x00, def.reqSize]);
                    }
                });
                if (document.getElementById("chkTonePart").checked) {
                    initialRequests.push([msb, lsb, 0x30, 0x00, 0x00, 0x00, 0x00, 0x29]);
                }
            }
        }

        if (initialRequests.length === 0) return;

        if (msb !== 0x01 && msb !== "active") {
            setupArea.innerHTML = "";
        }

        statusMessage.innerHTML = "Reading data sequentially...";

        // Throw initial requests into the global queue
        enqueueRequests(initialRequests);
    });
    // Automatically execute read when select box is changed
    toneSelect.addEventListener('change', () => {
        readSelectedButton.click();
    });
}

// Dedicated function to render the Setup Area
function renderSetup() {
    if (!appState.setup) return;

    const setupData = appState.setup;
    
    // Process to retrieve tone name from dictionary is moved here
    const toneKey = `${setupData.toneBsMsb}-${setupData.toneBsLsb}-${setupData.tonePc}`;
    const toneName = presetToneDictionary[toneKey] || "Unknown Tone (or User Tone)";

    let sysEffectTypeText = "Off";
    if (setupData.sysEffectTypeRaw > 0) {
        sysEffectTypeText = effectTypeMap[setupData.sysEffectTypeRaw - 1] || `Type ${setupData.sysEffectTypeRaw}`;
    }

    // Update the screen
    const setupArea = document.getElementById("setupArea");
    if (setupArea) {
        setupArea.innerHTML = `
            <h3>Setup Information</h3>
            Current Tone: <span class="tone-name">${toneName}</span><br><br>
            Tone Bank MSB: ${setupData.toneBsMsb}<br>
            Tone Bank LSB: ${setupData.toneBsLsb}<br>
            Tone PC: ${setupData.tonePc} (Device Program Number: ${setupData.tonePc + 1})<br><br>
            Favorite Bank Number: ${setupData.favBank} (Display: Bank ${setupData.favBank + 1})<br>
            Favorite Number: ${setupData.favNumber} (Display: Number ${setupData.favNumber + 1})<br>
            <strong>--- System Sound Settings ---</strong><br>
            System Effect Type: ${sysEffectTypeText}<br>
            System Effect Level: ${setupData.sysEffectLevel}
        `;
    }
}

// Dedicated function to render the System Common Area
function renderSystemCommon() {
    if (!appState.systemCommon) return;

    const payload = appState.systemCommon.payload;
    const systemCommonArea = document.getElementById("systemCommonArea");
    if (!systemCommonArea) return;

    // Dictionary object defining known parameters
    const sysCommonMap = {
        0x00: { name: "Display Contrast" },
        0x01: { name: "Auto Display Off", map: autoDisplayOffMap },
        0x02: { name: "Auto Power Off", map: autoPowerOffMap },
        0x03: { name: "Menu Startup Mode", map: menuStartupMap },
        0x04: { name: "Edit Confirm", map: onOffMap },
        0x05: { name: "Favorite Shortcut", map: onOffMap },
        0x06: { name: "Phones Mono/Stereo", map: phonesMonoStereoMap },
        0x07: { name: "Speaker Out", map: speakerOutMap },
        0x08: { name: "Phones Volume" },
        0x09: { name: "Speaker Volume" },
        0x0E: { name: "Transpose Source", map: transposeSourceMap },
        0x0F: { name: "Transpose", map: transposeMap },
        0x10: { name: "Fingering Mode", map: fingeringModeMap },
        0x11: { name: "Key Delay" },
        0x12: { name: "Hold Mode", map: onOffMap },
        0x14: { name: "Octave Mode", map: octaveModeMap },
        0x15: { name: "Bend Range", special: (val) => val === 0 ? "Follow Tone" : val - 1 },
        0x30: { name: "S1 Assign Source", map: assignSourceMap },
        0x31: { name: "S2 Assign Source", map: assignSourceMap },
        0x32: { name: "Thumb Assign Source", map: assignSourceMap },
        0x33: { name: "Breath Assign Source", map: assignSourceMap },
        0x35: { name: "Motion Roll Assign Source", map: assignSourceMap },
        0x36: { name: "Motion Tilt Assign Source", map: assignSourceMap },
        0x38: { name: "Motion Roll Mode", map: motionModeMap },
        0x39: { name: "Motion Tilt Mode", map: motionModeMap },
        0x3E: { name: "Motion Roll Vib Sense" },
        0x3F: { name: "Motion Tilt Vib Sense" },
        0x40: { name: "Breath Offset" },
        0x41: { name: "Breath Curve" },
        0x46: { name: "Harmonics Center", map: harmonicsCenterMap },
        0x48: { name: "Harmonics Delay" },
        0x4A: { name: "Harmonics Polarity", map: harmonicsPolarityMap },
        0x65: { name: "MIDI Tx Channel", special: (val) => val + 1 },
        0x66: { name: "MIDI Tx Velocity", special: (val) => val === 0 ? "Tongued" : `Fixed ${val}` }
    };

    let tableHtml = `
        <h3>System Common Settings</h3>
        <table>
            <tr><th>Address (Offset)</th><th>Parameter</th><th>Value</th></tr>
    `;

    // Guard processing to loop within received data length
    const dataLimit = Math.min(0x66, payload.length - 1);

    for (let offset = 0; offset <= dataLimit; offset++) {
        const hexOffset = ("0" + offset.toString(16).toUpperCase()).slice(-2);
        const rawValue = payload[offset];

        let paramName = "Unknown (Not Documented)";
        let displayValue = rawValue;

        // Set name and converted value if known parameter
        if (sysCommonMap[offset]) {
            paramName = sysCommonMap[offset].name;
            if (sysCommonMap[offset].special) {
                displayValue = sysCommonMap[offset].special(rawValue);
            } else if (sysCommonMap[offset].map) {
                displayValue = sysCommonMap[offset].map[rawValue] !== undefined ? sysCommonMap[offset].map[rawValue] : rawValue;
            }
        }

        // Special processing for multi-byte (nibble data)
        if (offset === 0x0A || offset === 0x0B || offset === 0x0C) {
            paramName = "Master Tune (Data part)";
        } else if (offset === 0x0D) {
            paramName = "Master Tune (Calculated)";
            const rawMasterTune = (payload[0x0A] << 12) | (payload[0x0B] << 8) | (payload[0x0C] << 4) | payload[0x0D];
            displayValue = rawMasterTune - 1024;
        } else if (offset === 0x3A) {
            paramName = "Motion Roll Center (Data part)";
        } else if (offset === 0x3B) {
            paramName = "Motion Roll Center (Calculated)";
            const rawRollCenter = (payload[0x3A] << 4) | payload[0x3B];
            displayValue = rawRollCenter - 128;
        } else if (offset === 0x3C) {
            paramName = "Motion Tilt Center (Data part)";
        } else if (offset === 0x3D) {
            paramName = "Motion Tilt Center (Calculated)";
            const rawTiltCenter = (payload[0x3C] << 4) | payload[0x3D];
            displayValue = rawTiltCenter - 128;
        }

        if (paramName === "Unknown (Not Documented)") {
            continue;
        }

        tableHtml += `<tr><td>00 ${hexOffset}</td><td>${paramName}</td><td>${displayValue}</td></tr>`;
    }

    tableHtml += `</table>`;
    systemCommonArea.innerHTML = tableHtml;
}

// Dedicated function to render the Tone Common Area
function renderToneCommon() {
    if (!appState.toneCommon) return;

    const tcData = appState.toneCommon;

    // Format for screen display
    const hdText = tcData.harmonyDrone === 0 ? "Harmony" : "Drone";
    const transText = transposeMap[tcData.toneTranspose] || tcData.toneTranspose;
    const octText = (tcData.octaveShift - 64) > 0 ? `+${tcData.octaveShift - 64}` : `${tcData.octaveShift - 64}`;
    const effTypeText = effectTypeMap[tcData.effectType] || `Type ${tcData.effectType}`;
    const intelHarmText = intelHarmonyMap[tcData.intelHarmony] || `Type ${tcData.intelHarmony}`;

    // Write to Tone Common specific area
    const toneCommonArea = document.getElementById("toneCommonArea");
    if (toneCommonArea) {
        toneCommonArea.innerHTML = `
            <h3>Tone Common Settings</h3>
            <table>
                <tr><th>Parameter</th><th>Value</th></tr>
                <tr><td>NAME (Tone Name)</td><td><strong>${tcData.nameStr}</strong></td></tr>
                <tr><td>Harmony/Drone</td><td>${hdText}</td></tr>
                <tr><td>Tone Level</td><td>${tcData.toneLevel}</td></tr>
                <tr><td>Effect Type</td><td>${effTypeText}</td></tr>
                <tr><td>Effect Level</td><td>${tcData.effectLevel}</td></tr>
                <tr><td>Tone Transpose</td><td>${transText}</td></tr>
                <tr><td>Tone Octave Shift</td><td>${octText}</td></tr>
                <tr><td>Intelligent Harmony</td><td>${intelHarmText}</td></tr>
            </table>
        `;
    }
}

// Dedicated function to render the Tone Part Area
function renderTonePart() {
    if (!appState.tonePart) return;

    const tpData = appState.tonePart;

    // Formatting for display
    const portaSwText = tpData.portaSw === 0 ? "OFF" : (tpData.portaSw === 1 ? "ON" : "TONE");
    
    // Output as a table on the screen
    const tonePartArea = document.getElementById("tonePartArea");
    if (tonePartArea) {
        tonePartArea.innerHTML = `
            <h3>Tone Part Settings</h3>
            <table>
                <tr><th>Parameter</th><th>Value</th></tr>
                <tr><td>Part Level</td><td>${tpData.partLevel}</td></tr>
                <tr><td>Part Pan</td><td>${tpData.partPan}</td></tr>
                <tr><td>Part Coarse Tune</td><td>${tpData.partCoarseTune}</td></tr>
                <tr><td>Part Fine Tune</td><td>${tpData.partFineTune}</td></tr>
                <tr><td>Portamento Switch</td><td>${portaSwText}</td></tr>
                <tr><td>Portamento Time</td><td>${tpData.portaTime}</td></tr>
                <tr><td>Cutoff Offset</td><td>${tpData.cutoff > 0 ? '+' + tpData.cutoff : tpData.cutoff}</td></tr>
                <tr><td>Resonance Offset</td><td>${tpData.reso > 0 ? '+' + tpData.reso : tpData.reso}</td></tr>
                <tr><td>AttackTime Offset</td><td>${tpData.attack > 0 ? '+' + tpData.attack : tpData.attack}</td></tr>
                <tr><td>DecayTime Offset</td><td>${tpData.decay > 0 ? '+' + tpData.decay : tpData.decay}</td></tr>
                <tr><td>ReleaseTime Offset</td><td>${tpData.release > 0 ? '+' + tpData.release : tpData.release}</td></tr>
                <tr><td>Vibrato Rate</td><td>${tpData.vibRate > 0 ? '+' + tpData.vibRate : tpData.vibRate}</td></tr>
                <tr><td>Vibrato Depth</td><td>${tpData.vibDepth > 0 ? '+' + tpData.vibDepth : tpData.vibDepth}</td></tr>
                <tr><td>Vibrato Delay</td><td>${tpData.vibDelay > 0 ? '+' + tpData.vibDelay : tpData.vibDelay}</td></tr>
                <tr><td>Chorus Send</td><td>${tpData.chorus}</td></tr>
                <tr><td>Reverb Send</td><td>${tpData.reverb}</td></tr>
                <tr><td>Delay Send</td><td>${tpData.delay}</td></tr>
            </table>
        `;
    }
}

// Dedicated function to render Assign Areas
function renderAssignArea(defId, prefix) {
    const def = assignDefs.find(d => d.id === defId);
    const state = appState.assigns[defId];
    const targetArea = def.areaElement();
    if (!targetArea || !def || !state) return;

    // System Source が 0 (OFF) の場合の描画
    if (state.source === 0) {
        targetArea.innerHTML = `<h3>${def.name} Settings</h3><p>Currently set to OFF (Disabled).</p>`;
        return;
    }

    const assignData = prefix === "System" ? state.sysData : state.toneData;
    if (!assignData) return;

    statusMessage.innerHTML = `${prefix} ${def.name} data read successfully!`;
    const setCount = assignData.length / 7;
    let html = `<h3>${prefix} ${def.name} Settings</h3>`;

    for (let i = 0; i < setCount; i++) {
        const offset = i * 7;
        const funcVal = assignData[offset + 0];
        const inMin = assignData[offset + 1];
        const inMax = assignData[offset + 2];
        const outMin = assignData[offset + 3];
        const outMax = assignData[offset + 4];
        const modeVal = assignData[offset + 5];
        const curveVal = assignData[offset + 6];

        html += `
        <h4>Assign ${i + 1}</h4>
        <table>
            <tr><th>Parameter</th><th>Value</th></tr>
            <tr><td>Function</td><td>${assignFunctionList[funcVal] || funcVal}</td></tr>
            <tr><td>Input Min</td><td>${inMin}</td></tr>
            <tr><td>Input Max</td><td>${inMax}</td></tr>
            <tr><td>Output Min</td><td>${outMin}</td></tr>
            <tr><td>Output Max</td><td>${outMax}</td></tr>
            <tr><td>Mode</td><td>${modeList[modeVal] || modeVal}</td></tr>
            <tr><td>Curve</td><td>${curveList[curveVal] || curveVal}</td></tr>
        </table>
        `;
    }
    targetArea.innerHTML = html;
}