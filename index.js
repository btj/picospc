function asBinaryString(n, x) {
    let result = '';
    while (n > 0) {
        result = ((x & 1) != 0 ? '1' : '0') + result;
        x = x >> 1;
        n--;
    }
    return result;
}

function decodeFloat8(x) {
    const isNegative = (x & 0x80) != 0;
    const rawExponent = (x & 0x7f) >> 3;
    const exponent = rawExponent - 7;
    const rawMantissa = x & 0x07;
    const bits = (isNegative ? '1' : '0') + ' ' + asBinaryString(4, rawExponent) + ' ' + asBinaryString(3, rawMantissa);
    const sign = isNegative ? '-' : '';
    let meaning;
    if (rawExponent == 15) {
        if (rawMantissa == 0)
            meaning = sign + '∞';
        else
            meaning = '(Not-a-Number)';
    } else if (rawExponent == 0) {
        meaning = sign + '0.' + asBinaryString(3, rawMantissa) + '<sub>2</sub>×2<sup>-6</sup>';
        meaning += ' = ' + sign + (rawMantissa / 8) + '×2<sup>-6</sup>';
        meaning += ' = ' + sign + (rawMantissa / 8) * Math.pow(2, -6);
    } else {
        meaning = sign + '1.' + asBinaryString(3, rawMantissa) + '<sub>2</sub>×2<sup>' + asBinaryString(4, rawExponent) + '<sub>2</sub> - 7</sup>';
        meaning += ' = ' + sign + (1 + rawMantissa / 8) + '×2<sup>' + exponent + '</sup>';
        meaning += ' = ' + sign + (1 + rawMantissa / 8) * Math.pow(2, exponent);
    }
    return bits + ' = ' + meaning;
}

function valueOfPositiveFloat8(x) {
    if (x > 120)
        return Number.NaN;
    else if (x == 120)
        return Number.POSITIVE_INFINITY;
    else if (x < 8) // denormal
        return x / 8 * Math.pow(2, -6);
    else
        return (1 + ((x & 7) / 8)) * Math.pow(2, (x >> 3) - 7);
}

function valueOfFloat8(x) {
    if (x <= 127)
        return valueOfPositiveFloat8(x);
    else
        return -valueOfPositiveFloat8(x - 128);
}

function float8OfPositiveValue(x) {
    if (Number.isNaN(x))
        return 127;
    if (x > 31/16 * 128)
        return 120;
    const exponent = Math.floor(Math.log2(x));
    if (exponent < -6)
        return Math.round(x * 512);
    else
        return (exponent + 7) * 8 + Math.round((x / Math.pow(2, exponent) - 1) * 8);
}

function float8OfValue(x) {
    if (x < 0)
        return float8OfPositiveValue(-x) + 128;
    return float8OfPositiveValue(x);
}

function addFloat8(x, y) {
    return float8OfValue(valueOfFloat8(x) + valueOfFloat8(y));
}

function h(tag, attrs, elems) {
    if (elems === undefined && attrs instanceof Array) {
        elems = attrs;
        attrs = undefined;
    }
    const result = document.createElement(tag);
    for (let key in attrs) {
        result.setAttribute(key, attrs[key]);
    }
    if (elems)
        for (let elem of elems) {
            if (typeof(elem) == 'string')
                elem = document.createTextNode(elem);
            result.appendChild(elem);
        }
    return result;
}

const Notation = {
    BINARY: 1,
    DECIMAL: 0
};
let notationSelect = null;
let ip = null;
let arrowsSvg = null;
let registersTable = null;
let memory = [];
let interpretationSelects = [];
let interpretationSpans = [];

function read(address) {
    return +memory[address].value;
}

function updateInterpretationSpans() {
    for (let i = 0; i < memory.length; i++)
        interpretationSpans[i].innerHTML = interpretationsList[interpretationSelects[i].selectedIndex].html(i);
    updateArrows();
}

function write(address, value) {
    setRegisterValue(memory[address], value);
    updateInterpretationSpans();
}

function addPoint(points, x, y) {
    const point = arrowsSvg.createSVGPoint();
    point.x = x;
    point.y = y;
    points.appendItem(point);
}

function addPoints(points, xys) {
    for (let i = 0; i < xys.length; i+=2)
        addPoint(points, xys[i], xys[i + 1]);
}

const svgns = "http://www.w3.org/2000/svg";

const arrowHeadsOffset = 5;
const arrowHeadWidth = 10;
const arrowsOffset = 5;
const leftMargin = 5;
const arrowColors = ['black', 'navy', 'purple', 'teal', 'olive', 'maroon', 'green', 'blueviolet', 'brown', 'darkgoldenrod', 'darkslategray', 'gray']

function updateArrows() {
    const arrows = [];
    function pushArrow(from, to) {
        if (0 <= to && to < memory.length)
            arrows.push([from, to]);
    }
    pushArrow(ip, +ip.value);
    for (let i = 0; i < memory.length; i++)
        if (interpretationsList[interpretationSelects[i].selectedIndex] == interpretations.ADDRESS)
            pushArrow(memory[i], +memory[i].value);
    while (arrowsSvg.lastChild != null)
        arrowsSvg.removeChild(arrowsSvg.lastChild);
    if (arrows.length == 0)
        return;
    let maxNbArrowsArrivingAtSamePlace = 1;
    let arrowsArrivingAt = new Map();
    for (let i = 0; i < arrows.length; i++) {
        const [from, to] = arrows[i];
        if (arrowsArrivingAt.has(to)) {
            arrowsArrivingAt.set(to, arrowsArrivingAt.get(to) + 1);
            if (maxNbArrowsArrivingAtSamePlace < arrowsArrivingAt.get(to))
                maxNbArrowsArrivingAtSamePlace = arrowsArrivingAt.get(to);
        } else
            arrowsArrivingAt.set(to, 1);
    }
    const arrowsSvgWidth = arrowHeadWidth + (maxNbArrowsArrivingAtSamePlace - 1) * arrowHeadsOffset + arrows.length * arrowsOffset + leftMargin;
    arrowsSvg.width.baseVal.newValueSpecifiedUnits(5, arrowsSvgWidth);
    const arrowsSvgRect = arrowsSvg.getBoundingClientRect();
    const precedingArrowsArrivingAt = new Map();
    for (let i = 0; i < arrows.length; i++) {
        const [from, to] = arrows[i];
        let nbPrecedingArrowsArrivingInSamePlace = precedingArrowsArrivingAt.has(to) ? precedingArrowsArrivingAt.get(to) : 0;
        if (precedingArrowsArrivingAt.has(to))
            precedingArrowsArrivingAt.set(to, precedingArrowsArrivingAt.get(to) + 1);
        else
            precedingArrowsArrivingAt.set(to, 1);
        const fromRect = from.getBoundingClientRect();
        const fromY = (fromRect.top + fromRect.bottom) / 2 - arrowsSvgRect.top;
        const toRect = memory[to].getBoundingClientRect();
        const toY = (toRect.top + toRect.bottom) / 2 - arrowsSvgRect.top;
        const polyline = document.createElementNS(svgns, 'polyline');
        polyline.style = 'fill:none;stroke:' + arrowColors[(i % arrowColors.length)] + ';stroke-width:3';
        const arrowX = leftMargin + i * arrowsOffset;
        const arrowHeadLeft = arrowsSvgWidth - arrowHeadWidth - nbPrecedingArrowsArrivingInSamePlace * arrowHeadsOffset;
        addPoints(polyline.points, [arrowsSvgWidth, fromY, arrowX, fromY, arrowX, toY, arrowHeadLeft, toY]);
        const polygon = document.createElementNS(svgns, 'polygon');
        polygon.style = 'fill:' + arrowColors[(i % arrowColors.length)];
        addPoints(polygon.points, [arrowHeadLeft + arrowHeadWidth, toY, arrowHeadLeft, toY - 5, arrowHeadLeft, toY + 5]);
        arrowsSvg.appendChild(polyline);
        arrowsSvg.appendChild(polygon);

        const maxY = Math.max(fromY, toY) + 5;
        if (arrowsSvgRect.bottom - arrowsSvgRect.top < maxY)
            arrowsSvg.height.baseVal.newValueSpecifiedUnits(5, maxY);
    }
}



function setIp(address) {
    setRegisterValue(ip, address);
    updateArrows();
}

function print(text) {
    const output = document.getElementById('output');
    if (output.innerText == '')
        output.innerText = 'Output: ' + text;
    else
        output.innerText += ', ' + text;
}

function step() {
    const opCode = read(+ip.value);
    switch (opCode) {
        case 1: write(read(+ip.value + 1), read(+ip.value + 2)); setIp(+ip.value + 3); break;
        case 2: write(read(+ip.value + 1), (read(read(+ip.value + 1)) + read(read(+ip.value + 2))) & 0xff); setIp(+ip.value + 3); break;
        case 3: write(read(+ip.value + 1), (read(read(+ip.value + 1)) + read(read(+ip.value + 2))) & 0xff); setIp(+ip.value + 3); break;
        case 4: write(read(+ip.value + 1), (read(read(+ip.value + 1)) + 1) & 0xff); setIp(+ip.value + 2); break;
        case 5: write(read(+ip.value + 1), (read(read(+ip.value + 1)) - 1) & 0xff); setIp(+ip.value + 2); break;
        case 6: if (read(read(+ip.value + 1)) == 0) setIp(read(+ip.value + 2)); else setIp(+ip.value + 3); break;
        case 7: if (read(read(+ip.value + 1)) != 0) setIp(read(+ip.value + 2)); else setIp(+ip.value + 3); break;
        case 8: setIp(read(+ip.value + 1)); break;
        case 9: write(read(+ip.value + 1), read(read(read(+ip.value + 2)))); setIp(+ip.value + 3); break;
        case 10: write(read(read(+ip.value + 1)), read(read(+ip.value + 2))); setIp(+ip.value + 3); break;
        case 11: write(read(+ip.value + 1), read(read(read(+ip.value + 2)) + read(+ip.value + 3))); setIp(+ip.value + 4); break;
        case 12: write(read(read(+ip.value + 1)) + read(+ip.value + 2), read(read(+ip.value + 3))); setIp(+ip.value + 4); break;
        case 13: print(read(read(+ip.value + 1))); setIp(+ip.value + 2); break;
        case 14: write(read(+ip.value + 1), read(read(+ip.value + 1)) - read(+ip.value + 2)); setIp(+ip.value + 3); break;
        case 15: write(read(+ip.value + 1), read(read(+ip.value + 2))); setIp(+ip.value + 3); break;
        case 16: write(read(+ip.value + 1), addFloat8(read(read(+ip.value + 1)), read(read(+ip.value + 2)))); setIp(+ip.value + 3); break;
    }
}

function decode(address) {
    switch (read(address)) {
        case 1: return "M[" + read(address + 1) + "] ← " + read(address + 2) + "; IP ← IP + 3";
        case 2: return "M[" + read(address + 1) + "] ← M[" + read(address + 1) + "] + M[" + read(address + 2) + "]; IP ← IP + 3";
        case 3: return "M[" + read(address + 1) + "] ← M[" + read(address + 1) + "] - M[" + read(address + 2) + "]; IP ← IP + 3";
        case 4: return "M[" + read(address + 1) + "] ← M[" + read(address + 1) + "] + 1; IP ← IP + 2";
        case 5: return "M[" + read(address + 1) + "] ← M[" + read(address + 1) + "] - 1; IP ← IP + 2";
        case 6: return "if M[" + read(address + 1) + "] = 0 then IP ← " + read(address + 2) + " else IP ← IP + 3";
        case 7: return "if M[" + read(address + 1) + "] ≠ 0 then IP ← " + read(address + 2) + " else IP ← IP + 3";
        case 8: return "IP ← " + read(address + 1);
        case 9: return "M[" + read(address + 1) + "] ← M[M[" + read(address + 2) + "]]; IP ← IP + 3";
        case 10: return "M[M[" + read(address + 1) + "]] ← M[" + read(address + 2) + "]; IP ← IP + 3";
        case 11: return "M[" + read(address + 1) + "] ← M[M[" + read(address + 2) + "] + " + read(address + 3) + "]; IP ← IP + 4";
        case 12: return "M[M[" + read(address + 1) + "] + " + read(address + 2) + "] ← M[" + read(address + 3) + "]; IP ← IP + 4";
        case 13: return "print M[" + read(address + 1) + "]; IP ← IP + 2";
        case 14: return "M[" + read(address + 1) + "] ← M[" + read(address + 1) + "] - " + read(address + 2) + "; IP ← IP + 3";
        case 15: return "M[" + read(address + 1) + "] ← M[" + read(address + 2) + "]; IP ← IP + 3";
        case 16: return "M[" + read(address + 1) + "] ← M[" + read(address + 1) + "] +<sub>float8</sub> M[" + read(address + 2) + "]; IP ← IP + 3";
        default: return "(not a valid instruction)";
    }
}

const examples = [
    {
        title: '',
        ip: 0,
        memory: [],
        interpretations: ''
    },
    {
        title: "Increment M[0] five times",
        ip: 1,
        memory: [0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 0],
        interpretations: ' I I I I I I'
    },
    {
        title: "Increment M[0] forever",
        ip: 1,
        memory: [0, 4, 0, 8, 1],
        interpretations: ' I I '
    },
    {
        title: "Compute M[0] times M[1] in M[2]",
        ip: 3,
        memory: [5, 3, 0, 7, 0, 7, 0, 2, 2, 1, 5, 0, 8, 3, 0],
        interpretations: '   I  II  I I  '
    },
    {
        title: "Sum up M[20..27] into M[2]",
        ip: 4,
        memory: [20, 8, 0, 0, 7, 1, 8, 0, 9, 3, 0, 2, 2, 3, 4, 0, 5, 1, 8, 4, 1, 2, 4, 8, 16, 32, 64, 128],
        interpretations: 'A   I  II  I  I I I        '
    },
    {
        title: "Increment M[21..28]",
        ip: 3,
        memory: [21, 8, 0, 7, 1, 7, 0, 9, 2, 0, 4, 2, 10, 0, 2, 4, 0, 5, 1, 8, 3, 10, 20, 30, 40, 50, 60, 70, 80],
        interpretations: 'A  I  II  I I  I I I         '
    },
    {
        title: "Convert M[22..26] to upper case",
        ip: 3,
        memory: [22, 5, 0, 7, 1, 7, 0, 9, 2, 0, 14, 2, 32, 10, 0, 2, 4, 0, 5, 1, 8, 3, 104, 101, 108, 108, 111],
        interpretations: 'A  I  II  I  I  I I I CCCCC'
    },
    {
        title: "Double a float8 value forever",
        ip: 1,
        memory: [1, 16, 0, 0, 8, 1],
        interpretations: 'FI  I '
    },
    {
        title: "Print the linked list at M[0]",
        ip: 2,
        memory: [20, 0, 7, 0, 6, 0, 9, 1, 0, 13, 1, 11, 0, 0, 1, 8, 2, 20, 24, 0, 10, 17, 40, 26, 30, 22, 50, 0],
        interpretations: 'A I  II  I I   I            '
    },
    {
        title: "Build a linked list with elements 1, 2, 3 at M[1]",
        ip: 3,
        memory: [30, 0, 3, 7, 2, 7, 0, 14, 0, 2, 10, 0, 2, 12, 0, 1, 1, 15, 1, 0, 5, 2, 8, 3, 0, 0, 0, 0, 0, 0],
        interpretations: 'A  I  II  I  I   I  I I      '
    }
];

function textHtml(text) {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
}

const interpretations = {
    'NONE': {
        letter: ' ',
        label: '',
        html(i) { return ' '; }
    },
    'INSTRUCTION': {
        letter: 'I',
        label: 'interpreted as an instruction means',
        html(i) { return decode(i); }
    },
    'ADDRESS': {
        letter: 'A',
        label: 'interpreted as an address means',
        html(i) { return '(see arrow)'; }
    },
    'CHARACTER': {
        letter: 'C',
        label: 'interpreted as a character means',
        text(i) {
            const c = read(i);
            if (c < 32 || c == 127)
                return '(control character)';
            else if (c > 127)
                return '(non-ASCII character)';
            else if (c == 32)
                return '(space character)';
            else
                return String.fromCharCode(c);
        },
        html(i) { return textHtml(this.text(i)); }
    },
    'FLOAT8': {
        letter: 'F',
        label: 'interpreted as a float8 means',
        html(i) { return decodeFloat8(read(i)); }
    }
};
const interpretationsList = Object.values(interpretations);
interpretationsList.forEach((i, index) => { i.index = index; });
const interpretationsByLetter = new Map(interpretationsList.map(i => [i.letter, i]));

function setState(state) {
    setRegisterValue(ip, state.ip);
    for (let i = 0; i < state.memory.length; i++) {
        write(i, state.memory[i]);
    }
    for (let i = state.memory.length; i < memory.length; i++)
        write(i, 0);
    for (let i = 0; i < state.memory.length; i++) {
        const interpretation = interpretationsByLetter.get(state.interpretations[i]);
        interpretationSelects[i].selectedIndex = interpretation.index;
        interpretationSelects[i].style.visibility = (interpretation.index == 0 ? 'hidden' : 'visible');
        interpretationSpans[i].innerHTML = interpretation.html(i);
    }
    for (let i = state.memory.length; i < memory.length; i++) {
        interpretationSelects[i].selectedIndex = 0;
        interpretationSelects[i].style.visibility = 'hidden';
        interpretationSpans[i].innerText = '';
    }
    updateArrows();
}

function setInputElementValue(element, value) {
    element.value = value;
    element.committedValue = value;
}

function setRegisterValue(element, value) {
    if (notationSelect.selectedIndex == Notation.BINARY)
        setInputElementValue(element, '0b' + asBinaryString(8, value));
    else
        setInputElementValue(element, '' + +value);
}

function validateInputElement(element, getErrorMessage, oncommit) {
    let lastMsgTime = null;
    element.committedValue = element.value;
    element.onchange = () => {
        const msg = getErrorMessage(element.value);
        if (msg != null) {
            if (lastMsgTime == null || Date.now() - lastMsgTime > 500) {
                lastMsgTime = Date.now();
                alert(msg);
                lastMsgTime = Date.now();
            }
        } else {
            element.committedValue = element.value;
            oncommit(element.value);
        }
    };
    element.onblur = () => {
        if (document.activeElement === element)
            return;
        const msg = getErrorMessage(element.value);
        if (msg != null) {
            element.focus();
            if (lastMsgTime == null || Date.now() - lastMsgTime > 500) {
                lastMsgTime = Date.now();
                alert(msg);
                lastMsgTime = Date.now();
            }
        }
    };
    element.onkeydown = e => {
        if (e.key == 'Escape')
            element.value = element.committedValue;
    };
}

function validateRegister(element, oncommit) {
    validateInputElement(element, value => {
        if (value != +value && !/^('.'|".")$/.test(value))
            return value + ': number expected';
        return null;
    }, value => {
        if (/^('.'|".")$/.test(value))
            setRegisterValue(element, value.charCodeAt(1) & 0xff);
        else if (value.includes('.'))
            setRegisterValue(element, float8OfValue(+value));
        else
            setRegisterValue(element, value & 0xff);
        oncommit();
    });
}

function addRegister() {
    const i = memory.length;
    const input = h('input', {value: '0', size: 10});
    memory.push(input);
    const interpretationSelect = h('select', {style: 'visibility: hidden'},
        interpretationsList.map(interpretation => new Option(interpretation.label)));
    interpretationSelects.push(interpretationSelect);
    const interpretationSpan = h('span');
    interpretationSpans.push(interpretationSpan);
    function updateView() {
        interpretationSpan.innerHTML = interpretationsList[interpretationSelect.selectedIndex].html(i);
        updateArrows();
    }
    interpretationSelect.onchange = updateView;
    const interpretationCell = h('td', [input, interpretationSelect, ' ', interpretationSpan]);
    interpretationCell.onmouseover = () => { interpretationSelect.style.visibility = 'visible'; };
    interpretationCell.onmouseout = () => {
        if (interpretationSelect.selectedIndex == 0)
            interpretationSelect.style.visibility = 'hidden';
    };
    registersTable.appendChild(h('tr', [h('td', {align: 'right'}, ['M[' + i + ']']), interpretationCell]));
    validateRegister(input, updateView);
}

function addAddMoreRegistersButton() {
    const button = h('button', ['Add more registers']);
    button.style.visibility = 'hidden';
    const cell = h('td', [button]);
    const row = h('tr', [h('td'), cell]);
    cell.onmouseover = () => { button.style.visibility = 'visible'; };
    cell.onmouseout = () => { button.style.visibility = 'hidden'; };
    button.onclick = () => {
        registersTable.removeChild(row);
        for (let i = 0; i < 10; i++)
            addRegister();
        addAddMoreRegistersButton();
    };
    registersTable.appendChild(row);
}

function init() {
    notationSelect = document.getElementById('notation');
    notationSelect.onchange = () => {
        setIp(ip.value);
        for (let i = 0; i < memory.length; i++)
            setRegisterValue(memory[i], memory[i].value);
    };
    ip = document.getElementById('ip');
    validateRegister(ip, updateArrows);
    arrowsSvg = document.getElementById('arrowsSvg');
    registersTable = document.getElementById('registers');
    for (let i = 0; i < 30; i++)
        addRegister();
    addAddMoreRegistersButton();
    setIp(0);
    const examplesSelect = document.getElementById('examples');
    for (let example_ of examples) {
        const example = example_;
        const option = new Option(example.title);
        examplesSelect.appendChild(option);
    }
    examplesSelect.onchange = () => {
        const example = examples[examplesSelect.selectedIndex];
        setState(example);
    };
}

async function save() {
    const memoryContents = memory.map(elem => elem.value);
    const interpretations = interpretationSelects.map(elem => interpretationsList[elem.selectedIndex].letter).join('');
    await navigator.clipboard.writeText(JSON.stringify({ip: +ip.value, memory: memoryContents, interpretations}));
    alert('Machine state copied to clipboard.');
}

function load() {
    const jsonArea = document.getElementById('json');
    if (jsonArea.style.display == 'none' || jsonArea.value == '') {
        jsonArea.style.display = 'block';
        alert('Please paste your machine state into the text area and click Load again.');
    } else {
        let state = null;
        try {
            state = JSON.parse(jsonArea.value);
        } catch (e) {
            alert('Malformed machine state');
            return;
        }
        setState(state);
        jsonArea.value = '';
        jsonArea.style.display = 'none';
    }
}
