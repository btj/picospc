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
let memory = [];

function read(address) {
    return +memory[address].value;
}

function write(address, value) {
    memory[address].value = value;
}

function step() {
    const opCode = read(+ip.value);
    switch (opCode) {
        case 1: write(read(+ip.value + 1), read(+ip.value + 2)); ip.value = +ip.value + 3; break;
        case 2: write(read(+ip.value + 1), (read(read(+ip.value + 1)) + read(read(+ip.value + 2))) & 0xff); ip.value = +ip.value + 3; break;
        case 3: write(read(+ip.value + 1), (read(read(+ip.value + 1)) + read(read(+ip.value + 2))) & 0xff); ip.value = +ip.value + 3; break;
        case 4: write(read(+ip.value + 1), (read(read(+ip.value + 1)) + 1) & 0xff); ip.value = +ip.value + 2; break;
        case 5: write(read(+ip.value + 1), (read(read(+ip.value + 1)) - 1) & 0xff); ip.value = +ip.value + 2; break;
        case 6: if (read(read(+ip.value + 1)) == 0) ip.value = read(+ip.value + 2); else ip.value = +ip.value + 3; break;
        case 7: if (read(read(+ip.value + 1)) != 0) ip.value = read(+ip.value + 2); else ip.value = +ip.value + 3; break;
        case 8: ip.value = read(+ip.value + 1); break;
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
        default: return "(not a valid instruction)";
    }
}

const examples = [
    {
        title: "Compute M[0] times M[1] in M[2]",
        ip: 3,
        memory: [5, 3, 0, 7, 0, 7, 0, 2, 2, 1, 5, 0, 8, 3, 0]
    }
];

function init() {
    ip = document.getElementById('ip');
    const registersTable = document.getElementById('registers');
    const memorySize = 30;
    for (let i = 0; i < memorySize; i++) {
        const input = h('input', {value: '0'});
        memory.push(input);
        const interpretationSelect = h('select', [new Option(), new Option('interpreted as an instruction means')]);
        const interpretationSpan = h('span');
        interpretationSelect.onchange = () => {
            switch (interpretationSelect.selectedIndex) {
                case 0: interpretationSpan.innerText = '';
                case 1: interpretationSpan.innerText = decode(i);
            }
        };
        registersTable.appendChild(h('tr', [h('td', ['M[' + i + ']']), h('td', [input, interpretationSelect, interpretationSpan])]));
    }
    const examplesSelect = document.getElementById('examples');
    for (let example_ of examples) {
        const example = example_;
        const option = new Option(example.title);
        examplesSelect.appendChild(option);
    }
    examplesSelect.onchange = () => {
        const example = examples[examplesSelect.selectedIndex - 1];
        ip.value = example.ip;
        for (let i = 0; i < example.memory.length; i++)
            write(i, example.memory[i]);
        for (let i = example.memory.length; i < memorySize; i++)
            write(i, 0);
    };
}

