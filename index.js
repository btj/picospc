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
let ipLine = null;
let ipLineArrowhead = null;
let ipLineSvg = null;
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
    const point = ipLineSvg.createSVGPoint();
    point.x = x;
    point.y = y;
    points.appendItem(point);
}

function addPoints(points, xys) {
    for (let i = 0; i < xys.length; i+=2)
        addPoint(points, xys[i], xys[i + 1]);
}

function setIp(address) {
    ip.value = address;
    const ipRect = ip.getBoundingClientRect();
    const memRect = memory[address].getBoundingClientRect();
    const ipLineSvgRect = ipLineSvg.getBoundingClientRect();
    const ipY = (ipRect.top + ipRect.bottom) / 2 - ipLineSvgRect.top;
    const memY = (memRect.top + memRect.bottom) / 2 - ipLineSvgRect.top;
    ipLine.points.clear();
    addPoints(ipLine.points, [50, ipY, 5, ipY, 5, memY, 40, memY]);
    ipLineArrowhead.points.clear();
    addPoints(ipLineArrowhead.points, [50, memY, 40, memY - 5, 40, memY + 5]);

    if (ipLineSvgRect.bottom - ipLineSvgRect.top < memY + 5)
        ipLineSvg.height.baseVal.newValueSpecifiedUnits(5, memY + 5);
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
        title: "Sum up M[20..27] into M[3]",
        ip: 4,
        memory: [20, 8, 0, 0, 7, 1, 8, 0, 9, 3, 0, 2, 2, 3, 4, 0, 5, 1, 8, 4, 1, 2, 4, 8, 16, 32, 64, 128],
        interpretations: '    I  II  I  I I I        '
    },
    {
        title: "Increment M[21..28]",
        ip: 3,
        memory: [21, 8, 0, 7, 1, 7, 0, 9, 2, 0, 4, 2, 10, 0, 2, 4, 0, 5, 1, 8, 3, 10, 20, 30, 40, 50, 60, 70, 80],
        interpretations: '   I  II  I I  I I I         '
    }
];

const memorySize = 30;

function setState(state) {
    setIp(state.ip);
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
}

function init() {
    ip = document.getElementById('ip');
    ipLine = document.getElementById('ipLine');
    ipLineArrowhead = document.getElementById('ipLineArrowhead');
    ipLineSvg = document.getElementById('ipLineSvg');
    const registersTable = document.getElementById('registers');
    for (let i = 0; i < memorySize; i++) {
        const input = h('input', {value: '0'});
        memory.push(input);
        const interpretationSelect = h('select', {style: 'visibility: hidden'}, [new Option(), new Option('interpreted as an instruction means')]);
        interpretationSelects.push(interpretationSelect);
        const interpretationSpan = h('span');
        interpretationSpans.push(interpretationSpan);
        interpretationSelect.onchange = () => {
            switch (interpretationSelect.selectedIndex) {
                case 0: interpretationSpan.innerText = ''; break;
                case 1: interpretationSpan.innerText = decode(i); break;
            }
        };
        const interpretationCell = h('td', [input, interpretationSelect, interpretationSpan]);
        interpretationCell.onmouseover = () => { interpretationSelect.style.visibility = 'visible'; };
        interpretationCell.onmouseout = () => {
            if (interpretationSelect.selectedIndex == 0)
                interpretationSelect.style.visibility = 'hidden';
        };
        registersTable.appendChild(h('tr', [h('td', {align: 'right'}, ['M[' + i + ']']), interpretationCell]));
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
        setIp(example.ip);
        for (let i = 0; i < example.memory.length; i++) {
            write(i, example.memory[i]);
        }
        for (let i = example.memory.length; i < memorySize; i++)
            write(i, 0);
        for (let i = 0; i < example.memory.length; i++) {
            if (example.interpretations[i] == 'I') {
                interpretationSelects[i].selectedIndex = 1;
                interpretationSelects[i].style.visibility = 'visible';
                interpretationSpans[i].innerText = decode(i);
            } else {
                interpretationSelects[i].selectedIndex = 0;
                interpretationSelects[i].style.visibility = 'hidden';
                interpretationSpans[i].innerText = '';
            }
        }
        for (let i = example.memory.length; i < memorySize; i++) {
            interpretationSelects[i].selectedIndex = 0;
            interpretationSelects[i].style.visibility = 'hidden';
            interpretationSpans[i].innerText = '';
        }
    };
}

async function save() {
    const memoryContents = memory.map(elem => elem.value);
    const interpretations = interpretationSelects.map(elem => elem.selectedIndex == 1 ? 'I' : ' ').join('');
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