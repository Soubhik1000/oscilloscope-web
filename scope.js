const connectButton = document.getElementById("connect");
const pauseButton = document.getElementById("pause");

const timeDivSelect = document.getElementById("timeDiv");
const voltsDivSelect = document.getElementById("voltsDiv");

const canvas = document.getElementById("scope");
const ctx = canvas.getContext("2d");

const valueDisplay = document.getElementById("value");


// =========================
// Serial
// =========================

let port;
let reader;
let buffer = "";


// =========================
// Scope settings
// =========================

const MAX_SAMPLES = 2000;

let timeDiv = 20;
let voltsDiv = 1;

let paused = false;


// =========================
// Live buffer
// =========================

const samples = new Array(MAX_SAMPLES).fill(0);

let sampleIndex = 0;
let sampleCount = 0;


// =========================
// Display buffer
// =========================

let displaySamples = [];

let sweepReady = false;


// =========================
// Average
// =========================

let totalADC = 0;


// =========================
// UI
// =========================

timeDivSelect.addEventListener("change", () => {

    timeDiv = Number(timeDivSelect.value);

    resetSweep();

});


voltsDivSelect.addEventListener("change", () => {

    voltsDiv = Number(voltsDivSelect.value);

    drawScope();

});


pauseButton.addEventListener("click", () => {

    paused = !paused;

    pauseButton.textContent =
        paused ? "Resume" : "Pause";

});


// =========================
// Connect
// =========================

connectButton.addEventListener("click", async () => {

    try {

        port =
            await navigator.serial.requestPort();

        await port.open({
            baudRate: 115200
        });

        connectButton.textContent =
            "Connected";

        readSerial();

    } catch (error) {

        console.error(error);

        alert("Could not connect to Arduino.");

    }

});


// =========================
// Serial reader
// =========================

async function readSerial() {

    reader =
        port.readable.getReader();

    try {

        while (true) {

            const { value, done } =
                await reader.read();

            if (done) {
                break;
            }

            const text =
                new TextDecoder().decode(value);

            buffer += text;

            const lines =
                buffer.split("\n");

            buffer = lines.pop();


            for (const line of lines) {

                const adc =
                    Number(line.trim());

                if (
                    Number.isInteger(adc) &&
                    adc >= 0 &&
                    adc <= 1023
                ) {

                    addSample(adc);

                }

            }

        }

    } catch (error) {

        console.error(error);

    } finally {

        reader.releaseLock();

    }

}


// =========================
// Add sample
// =========================

function addSample(adc) {

    if (paused) {
        return;
    }


    // Remove old value from average

    if (sampleCount === MAX_SAMPLES) {

        totalADC -=
            samples[sampleIndex];

    }


    // Store new sample

    samples[sampleIndex] = adc;

    totalADC += adc;


    sampleIndex++;

    if (sampleIndex >= MAX_SAMPLES) {
        sampleIndex = 0;
    }


    if (sampleCount < MAX_SAMPLES) {
        sampleCount++;
    }


    updateValueDisplay(adc);

    captureSweep();

}


// =========================
// Capture sweep
// =========================

function captureSweep() {

    const totalTime =
        timeDiv * 10;


    let samplesNeeded =
        Math.round(totalTime);


    samplesNeeded =
        Math.min(
            samplesNeeded,
            MAX_SAMPLES
        );


    samplesNeeded =
        Math.max(
            samplesNeeded,
            2
        );


    /*
     * Don't create a new sweep until
     * enough samples are available.
     */

    if (sampleCount < samplesNeeded) {
        return;
    }


    /*
     * Copy the latest samples.
     */

    const newDisplay =
        new Array(samplesNeeded);


    const start =
        sampleIndex - samplesNeeded;


    for (let i = 0; i < samplesNeeded; i++) {

        const index =
            (start + i + MAX_SAMPLES)
            % MAX_SAMPLES;

        newDisplay[i] =
            samples[index];

    }


    displaySamples =
        newDisplay;


    sweepReady = true;

}


// =========================
// Reset sweep
// =========================

function resetSweep() {

    displaySamples = [];

    sweepReady = false;

}


// =========================
// Value display
// =========================

let lastDisplayUpdate = 0;

function updateValueDisplay(adc) {

    /*
     * Don't update the DOM for every serial
     * sample. DOM updates are expensive.
     */

    const now =
        performance.now();

    if (now - lastDisplayUpdate < 100) {
        return;
    }

    lastDisplayUpdate = now;


    const voltage =
        adc * 5.0 / 1023.0;


    const averageADC =
        sampleCount > 0
            ? totalADC / sampleCount
            : 0;


    const averageVoltage =
        averageADC * 5.0 / 1023.0;


    valueDisplay.textContent =
        `ADC: ${adc} | ` +
        `Voltage: ${voltage.toFixed(3)} V | ` +
        `Average: ${averageVoltage.toFixed(3)} V`;

}


// =========================
// Draw grid
// =========================

function drawGrid() {

    const width =
        canvas.width;

    const height =
        canvas.height;


    const divisionsX = 10;
    const divisionsY = 10;


    const divisionWidth =
        width / divisionsX;

    const divisionHeight =
        height / divisionsY;


    ctx.strokeStyle =
        "#263026";

    ctx.lineWidth = 1;


    // Vertical lines

    for (
        let i = 0;
        i <= divisionsX;
        i++
    ) {

        const x =
            i * divisionWidth;

        ctx.beginPath();

        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);

        ctx.stroke();

    }


    // Horizontal lines

    for (
        let i = 0;
        i <= divisionsY;
        i++
    ) {

        const y =
            i * divisionHeight;

        ctx.beginPath();

        ctx.moveTo(0, y);
        ctx.lineTo(width, y);

        ctx.stroke();

    }


    // 2.5 V center line

    ctx.strokeStyle =
        "#555";

    ctx.beginPath();

    ctx.moveTo(
        0,
        height / 2
    );

    ctx.lineTo(
        width,
        height / 2
    );

    ctx.stroke();


    // Center vertical line

    ctx.beginPath();

    ctx.moveTo(
        width / 2,
        0
    );

    ctx.lineTo(
        width / 2,
        height
    );

    ctx.stroke();

}


// =========================
// Draw waveform
// =========================

function drawWaveform() {

    if (!sweepReady) {
        return;
    }


    if (displaySamples.length < 2) {
        return;
    }


    const width =
        canvas.width;

    const height =
        canvas.height;


    const pixelsPerDivision =
        height / 10;


    ctx.strokeStyle =
        "#00ff88";

    ctx.lineWidth = 2;

    ctx.beginPath();


    const lastIndex =
        displaySamples.length - 1;


    for (
        let i = 0;
        i < displaySamples.length;
        i++
    ) {

        const adc =
            displaySamples[i];


        const voltage =
            adc * 5.0 / 1023.0;


        const x =
            (i / lastIndex) * width;


        const y =
            height / 2 -
            (
                (voltage - 2.5)
                / voltsDiv
            ) *
            pixelsPerDivision;


        if (i === 0) {

            ctx.moveTo(x, y);

        } else {

            ctx.lineTo(x, y);

        }

    }


    ctx.stroke();

}


// =========================
// Draw complete scope
// =========================

function drawScope() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Background

    ctx.fillStyle =
        "#050505";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawGrid();

    drawWaveform();

}


// =========================
// Initial draw
// =========================

drawScope();


// =========================
// Redraw only when needed
// =========================

setInterval(() => {

    if (sweepReady) {

        drawScope();

        sweepReady = false;

    }

}, 33);