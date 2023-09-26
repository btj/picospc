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

let ip = null;
let arrowsSvg = null;
let memory = [];
let interpretationSelects = [];
let interpretationSpans = [];

function read(address) {
    return +memory[address].value;
}

function write(address, value) {
    memory[address].value = value;
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
        if (interpretationSelects[i].selectedIndex == 2)
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
    ip.value = address;
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

const memorySize = 30;

function setState(state) {
    ip.value = state.ip;
    for (let i = 0; i < state.memory.length; i++) {
        write(i, state.memory[i]);
    }
    for (let i = state.memory.length; i < memorySize; i++)
        write(i, 0);
    for (let i = 0; i < state.memory.length; i++) {
        if (state.interpretations[i] == 'I') {
            interpretationSelects[i].selectedIndex = 1;
            interpretationSelects[i].style.visibility = 'visible';
            interpretationSpans[i].innerText = decode(i);
        } else if (state.interpretations[i] == 'A') {
            interpretationSelects[i].selectedIndex = 2;
            interpretationSelects[i].style.visibility = 'visible';
            interpretationSpans[i].innerText = '(see arrow)';
        } else {
            interpretationSelects[i].selectedIndex = 0;
            interpretationSelects[i].style.visibility = 'hidden';
            interpretationSpans[i].innerText = '';
        }
    }
    for (let i = state.memory.length; i < memorySize; i++) {
        interpretationSelects[i].selectedIndex = 0;
        interpretationSelects[i].style.visibility = 'hidden';
        interpretationSpans[i].innerText = '';
    }
    updateArrows();
}

function init() {
    ip = document.getElementById('ip');
    ip.onchange = updateArrows;
    arrowsSvg = document.getElementById('arrowsSvg');
    const registersTable = document.getElementById('registers');
    for (let i = 0; i < memorySize; i++) {
        const input = h('input', {value: '0'});
        memory.push(input);
        const interpretationSelect = h('select', {style: 'visibility: hidden'}, [
            new Option(),
            new Option('interpreted as an instruction means'),
            new Option('interpreted as an address means')
        ]);
        interpretationSelects.push(interpretationSelect);
        const interpretationSpan = h('span');
        interpretationSpans.push(interpretationSpan);
        function updateView() {
            switch (interpretationSelect.selectedIndex) {
                case 0: interpretationSpan.innerText = ''; break;
                case 1: interpretationSpan.innerText = decode(i); break;
                case 2: interpretationSpan.innerText = '(see arrow)'; break;
            }
            updateArrows();
        }
        interpretationSelect.onchange = updateView;
        const interpretationCell = h('td', [input, interpretationSelect, interpretationSpan]);
        interpretationCell.onmouseover = () => { interpretationSelect.style.visibility = 'visible'; };
        interpretationCell.onmouseout = () => {
            if (interpretationSelect.selectedIndex == 0)
                interpretationSelect.style.visibility = 'hidden';
        };
        registersTable.appendChild(h('tr', [h('td', {align: 'right'}, ['M[' + i + ']']), interpretationCell]));
        input.onchange = updateView;
    }
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
    const interpretations = interpretationSelects.map(elem =>
        elem.selectedIndex == 1 ? 'I' :
        elem.selectedIndex == 2 ? 'A' :
        ' ').join('');
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
