// =====================================================
// GLOBAL STATE
// =====================================================

let xmlDoc = null;
let originalFileName = "";
let modifiedXMLString = "";
let selectedInstance = null;

let fullPreviewContent = "";
let isExpanded = false;

let fileHistory = JSON.parse(localStorage.getItem("history")) || [];


// =====================================================
// DOM REFERENCES
// =====================================================

const fileInput = document.getElementById("xmlFile");
const dropdown = document.getElementById("tagDropdown");
const typeDropdown = document.getElementById("typeDropdown");
const nameDropdown = document.getElementById("nameDropdown");
const newValueInput = document.getElementById("newValue");
const modifyBtn = document.getElementById("modifyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const xmlPreview = document.getElementById("xmlPreview");
const historyList = document.getElementById("historyList");
const togglePreviewBtn = document.getElementById("togglePreviewBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

renderHistory();


// =====================================================
// UI STATE HELPERS
// =====================================================

function resetModifyState() {
    modifyBtn.textContent = "Modify XML";
    modifyBtn.style.background = "";
    downloadBtn.classList.add("hidden");
}

function resetUI() {
    selectedInstance = null;

    typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';

    dropdown.value = "";
    dropdown.disabled = true;
    nameDropdown.disabled = true;

    newValueInput.value = "";
    downloadBtn.classList.add("hidden");
}

newValueInput.addEventListener("input", resetModifyState);


// =====================================================
// FILE UPLOAD
// =====================================================

fileInput.addEventListener("change", function (event) {

    resetUI();

    const file = event.target.files[0];
    if (!file) return;

    originalFileName = file.name;

    // History Logic
    fileHistory.unshift(originalFileName);
    fileHistory = [...new Set(fileHistory)];
    if (fileHistory.length > 10) {
        fileHistory = fileHistory.slice(0, 10);
    }

    localStorage.setItem("history", JSON.stringify(fileHistory));
    renderHistory();

    const reader = new FileReader();

    reader.onload = function (e) {

        const buffer = e.target.result;
        const bytes = new Uint8Array(buffer);
        const encoding = detectEncoding(bytes);

        let text;

        try {
            text = new TextDecoder(encoding).decode(buffer);
        } catch {
            alert("File decoding failed.");
            return;
        }

        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
        }

        if (text.includes("\u0000")) {
            alert("Encoding mismatch detected.");
            return;
        }

        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(text, "application/xml");

        const parseError = xmlDoc.querySelector("parsererror");
        if (parseError) {
            console.error(parseError.textContent);
            alert("XML parsing failed.");
            return;
        }

        xmlPreview.textContent = text;
        populateTypeDropdown();
    };

    reader.readAsArrayBuffer(file);
});


// =====================================================
// DROPDOWN LOGIC
// =====================================================

function populateTypeDropdown() {

    typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';

    dropdown.value = "";
    dropdown.disabled = true;
    nameDropdown.disabled = true;

    const instances = xmlDoc.getElementsByTagName("CDOInstance");
    const typeSet = new Set();

    for (let i = 0; i < instances.length; i++) {
        const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
        if (typeNode) {
            typeSet.add(typeNode.textContent.trim());
        }
    }

    Array.from(typeSet).sort().forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        typeDropdown.appendChild(option);
    });
}


typeDropdown.addEventListener("change", function () {

    const selectedType = typeDropdown.value;

    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
    dropdown.innerHTML = '<option value="">Select Tag</option>';
    dropdown.disabled = true;

    if (!selectedType) {
        nameDropdown.disabled = true;
        return;
    }

    const instances = xmlDoc.getElementsByTagName("CDOInstance");
    const nameSet = new Set();

    for (let i = 0; i < instances.length; i++) {

        const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
        const nameNode = instances[i].getElementsByTagName("ObjectName")[0];

        if (typeNode && nameNode && typeNode.textContent.trim() === selectedType) {
            nameSet.add(nameNode.textContent.trim());
        }
    }

    Array.from(nameSet).sort().forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        nameDropdown.appendChild(option);
    });

    nameDropdown.disabled = false;
});


nameDropdown.addEventListener("change", function () {

    const selectedType = typeDropdown.value;
    const selectedName = nameDropdown.value;

    dropdown.innerHTML = '<option value="">Select Tag</option>';

    if (!selectedName) {
        dropdown.disabled = true;
        return;
    }

    const instances = xmlDoc.getElementsByTagName("CDOInstance");
    selectedInstance = null;

    for (let i = 0; i < instances.length; i++) {

        const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
        const nameNode = instances[i].getElementsByTagName("ObjectName")[0];

        if (
            typeNode &&
            nameNode &&
            typeNode.textContent.trim() === selectedType &&
            nameNode.textContent.trim() === selectedName
        ) {
            selectedInstance = instances[i];
            break;
        }
    }

    if (!selectedInstance) {
        dropdown.disabled = true;
        return;
    }

    const tagSet = new Set();

    function collectTags(node) {
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            tagSet.add(child.tagName);
            collectTags(child);
        }
    }

    collectTags(selectedInstance);

    const datalist = document.getElementById("tagList");
    datalist.innerHTML = "";

    Array.from(tagSet).sort().forEach(tag => {
        const option = document.createElement("option");
        option.value = tag;
        datalist.appendChild(option);
    });

    dropdown.disabled = false;
    dropdown.value = "";

    const serializer = new XMLSerializer();
    xmlPreview.textContent = formatXML(
        serializer.serializeToString(selectedInstance)
    );
});


// =====================================================
// MODIFY LOGIC
// =====================================================

modifyBtn.addEventListener("click", function () {

    if (!xmlDoc) {
        alert("Upload XML first.");
        return;
    }

    if (!selectedInstance) {
        alert("Select Object Type and Name first.");
        return;
    }

    const selectedTag = dropdown.value;
    const newValue = newValueInput.value.trim();

    if (!selectedTag) {
        alert("Select a tag.");
        return;
    }

    if (newValue === "") {
        alert("Enter a value.");
        return;
    }

    const matchingNodes = selectedInstance.getElementsByTagName(selectedTag);

    if (matchingNodes.length === 0) {
        alert("Tag not found.");
        return;
    }

    let replacedCount = 0;

    for (let i = 0; i < matchingNodes.length; i++) {

        const node = matchingNodes[i];

        if (node.hasAttribute("__empty")) {
            node.removeAttribute("__empty");
        }

        let cdataNode = null;

        for (let j = 0; j < node.childNodes.length; j++) {
            if (node.childNodes[j].nodeType === 4) {
                cdataNode = node.childNodes[j];
                break;
            }
        }

        if (cdataNode) {
            cdataNode.nodeValue = newValue;
            replacedCount++;
            continue;
        }

        let textNodeFound = false;

        for (let j = 0; j < node.childNodes.length; j++) {
            if (node.childNodes[j].nodeType === 3) {
                node.childNodes[j].nodeValue = newValue;
                textNodeFound = true;
                replacedCount++;
                break;
            }
        }

        if (!textNodeFound && node.childNodes.length === 0) {
            node.textContent = newValue;
            replacedCount++;
        }
    }

    if (replacedCount === 0) {
        alert("No editable nodes found.");
        return;
    }

    const serializer = new XMLSerializer();
    modifiedXMLString = serializer.serializeToString(xmlDoc);

    let formatted = formatXML(
        serializer.serializeToString(selectedInstance)
    );

    let escaped = escapeHTML(formatted);

    const safeValue = newValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const valueRegex = new RegExp(safeValue, "g");

    escaped = escaped.replace(
        valueRegex,
        `<span class="value-highlight">${newValue}</span>`
    );

    xmlPreview.innerHTML = escaped;

    newValueInput.value = "";
    downloadBtn.classList.remove("hidden");

    modifyBtn.textContent = "Done!";
    modifyBtn.style.background =
        "linear-gradient(135deg,#10b981,#22c55e)";
});


// =====================================================
// DOWNLOAD LOGIC
// =====================================================

downloadBtn.addEventListener("click", function () {

    if (!modifiedXMLString) return;

    let xmlContent = modifiedXMLString;

    if (!xmlContent.startsWith("<?xml")) {
        xmlContent =
            '<?xml version="1.0" encoding="UTF-16LE"?>\r\n' +
            xmlContent;
    } else {
        xmlContent = xmlContent.replace(
            /encoding="[^"]*"/,
            'encoding="UTF-16LE"'
        );
    }

    const buffer = new ArrayBuffer(xmlContent.length * 2 + 2);
    const view = new DataView(buffer);

    view.setUint16(0, 0xFEFF, true);

    for (let i = 0; i < xmlContent.length; i++) {
        view.setUint16(i * 2 + 2, xmlContent.charCodeAt(i), true);
    }

    const blob = new Blob([buffer], {
        type: "application/xml;charset=UTF-16LE"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "modified_" + originalFileName;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});


// =====================================================
// PREVIEW LOGIC
// =====================================================

function showPreview(content) {

    fullPreviewContent = content;

    const lines = content.split("\n");

    if (lines.length > 60) {

        const previewText = lines.slice(0, 60).join("\n");
        xmlPreview.textContent = previewText;

        togglePreviewBtn.classList.remove("hidden");
        togglePreviewBtn.textContent = "Read More";

        xmlPreview.classList.add("collapsed");
        xmlPreview.classList.remove("expanded");

        isExpanded = false;

    } else {
        xmlPreview.textContent = content;
        togglePreviewBtn.classList.add("hidden");
    }
}

togglePreviewBtn.addEventListener("click", function () {

    if (!isExpanded) {
        xmlPreview.textContent = fullPreviewContent;
        togglePreviewBtn.textContent = "Read Less";
        xmlPreview.classList.remove("collapsed");
        xmlPreview.classList.add("expanded");
        isExpanded = true;
    } else {
        showPreview(fullPreviewContent);
    }
});


// =====================================================
// HISTORY LOGIC
// =====================================================

function renderHistory() {
    historyList.innerHTML = "";
    fileHistory.forEach(function (name) {
        const li = document.createElement("li");
        li.textContent = name;
        historyList.appendChild(li);
    });
}

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", function () {
        fileHistory = [];
        localStorage.removeItem("history");
        renderHistory();
    });
}


// =====================================================
// UTILITIES
// =====================================================

function formatXML(xml) {
    const PADDING = "  ";
    const reg = /(>)(<)(\/*)/g;
    let formatted = "";
    let pad = 0;

    xml = xml.replace(reg, "$1\r\n$2$3");
    const lines = xml.split("\r\n");

    for (let i = 0; i < lines.length; i++) {

        let indent = 0;

        if (lines[i].match(/^<\/\w/)) {
            if (pad !== 0) pad -= 1;
        } else if (lines[i].match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
        }

        formatted += PADDING.repeat(pad) + lines[i] + "\r\n";
        pad += indent;
    }

    return formatted.trim();
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function detectEncoding(bytes) {

    if (bytes[0] === 0xFF && bytes[1] === 0xFE)
        return "utf-16le";

    if (bytes[0] === 0xFE && bytes[1] === 0xFF)
        return "utf-16be";

    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
        return "utf-8";

    if (bytes[1] === 0x00)
        return "utf-16le";

    if (bytes[0] === 0x00)
        return "utf-16be";

    return "utf-8";
}