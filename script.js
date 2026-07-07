// =====================================================
// GLOBAL STATE
// =====================================================

let xmlDoc = null;
let originalFileName = "";
let modifiedXMLString = "";
let selectedInstance = null;
let tagIndex = [];

let fullPreviewContent = "";
let isExpanded = false;

let fileHistory = JSON.parse(localStorage.getItem("history")) || [];

// NEW: tag selection state
let selectedTagNode = null;
let flatTagList = [];


// =====================================================
// DOM REFERENCES
// =====================================================

const fileInput         = document.getElementById("xmlFile");
const typeDropdown      = document.getElementById("typeDropdown");
const nameDropdown      = document.getElementById("nameDropdown");
const newValueInput     = document.getElementById("newValue");
const modifyBtn         = document.getElementById("modifyBtn");
const downloadBtn       = document.getElementById("downloadBtn");
const xmlPreview        = document.getElementById("xmlPreview");
const historyList       = document.getElementById("historyList");
const togglePreviewBtn  = document.getElementById("togglePreviewBtn");
const clearHistoryBtn   = document.getElementById("clearHistoryBtn");
const tagSearch         = document.getElementById("tagSearch");
const tagListContainer  = document.getElementById("tagListContainer");
const tagList           = document.getElementById("tagList");

renderHistory();


// =====================================================
// UI STATE HELPERS
// =====================================================

function resetModifyState() {
    modifyBtn.textContent = "Modify XML";
    modifyBtn.style.background = "";
    downloadBtn.classList.add("hidden");
}

function resetTagField() {
    selectedTagNode = null;
    flatTagList = [];
    tagSearch.value = "";
    tagSearch.disabled = true;
    tagListContainer.style.display = "none";
    tagList.innerHTML = "";
}

function resetUI() {
    selectedInstance = null;

    typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
    nameDropdown.disabled = true;

    resetTagField();

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
        const bytes  = new Uint8Array(buffer);
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
// DROPDOWN LOGIC — TYPE & NAME
// =====================================================

function populateTypeDropdown() {

    typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
    nameDropdown.disabled = true;
    resetTagField();

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
    nameDropdown.disabled = true;
    resetTagField();

    if (!selectedType) return;

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

    resetTagField();

    if (!selectedName) return;

    const instances = xmlDoc.getElementsByTagName("CDOInstance");
    selectedInstance = null;

    for (let i = 0; i < instances.length; i++) {
        const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
        const nameNode = instances[i].getElementsByTagName("ObjectName")[0];

        if (
            typeNode && nameNode &&
            typeNode.textContent.trim() === selectedType &&
            nameNode.textContent.trim() === selectedName
        ) {
            selectedInstance = instances[i];
            break;
        }
    }

    if (!selectedInstance) return;

    buildFlatTagList();
});


// =====================================================
// TAG SELECTION — FLAT SEARCHABLE LIST
// =====================================================

function buildFlatTagList() {

    flatTagList = [];
    selectedTagNode = null;

    if (!selectedInstance) return;

    const exportData = selectedInstance.querySelector("ExportData");
    if (!exportData) return;

    walkNode(exportData, []);

    // CDATA fields first, then plain VALUE fields
    flatTagList.sort((a, b) => {
        if (a.type === "CDATA" && b.type !== "CDATA") return -1;
        if (a.type !== "CDATA" && b.type === "CDATA") return 1;
        return 0;
    });

    // Add [0],[1] index to duplicate paths so user can tell them apart
    const pathCount = {};
    flatTagList.forEach(item => {
        pathCount[item.path] = (pathCount[item.path] || 0) + 1;
    });
    const pathSeen = {};
    flatTagList.forEach(item => {
        if (pathCount[item.path] > 1) {
            const idx = pathSeen[item.path] || 0;
            item.displayPath = item.path + " [" + idx + "]";
            pathSeen[item.path] = idx + 1;
        } else {
            item.displayPath = item.path;
        }
    });

    tagSearch.disabled = false;
    tagSearch.value = "";
    tagSearch.placeholder = "Search by tag name or current value...";
    renderTagList(flatTagList);
    tagListContainer.style.display = "block";
}


function walkNode(node, ancestorPath) {

    const skipTags = ["ExportData", "BaseExportData"];
    const children = Array.from(node.children);

    if (children.length === 0) {

        let val  = null;
        let type = null;

        const cdataNode = Array.from(node.childNodes).find(n => n.nodeType === 4);
        if (cdataNode) {
            val  = cdataNode.nodeValue;
            type = "CDATA";
        } else {
            const textNode = Array.from(node.childNodes).find(
                n => n.nodeType === 3 && n.nodeValue.trim() !== ""
            );
            if (textNode) {
                val  = textNode.nodeValue.trim();
                type = "VALUE";
            }
        }

        if (val !== null && val !== "") {
            const path = [...ancestorPath, node.tagName].join(" > ");
            flatTagList.push({
                path:        path,
                displayPath: path,
                value:       val,
                type:        type,
                node:        node
            });
        }

    } else {
        const newPath = skipTags.includes(node.tagName)
            ? ancestorPath
            : [...ancestorPath, node.tagName];

        children.forEach(child => walkNode(child, newPath));
    }
}


function renderTagList(items) {

    tagList.innerHTML = "";

    if (items.length === 0) {
        tagList.innerHTML =
            '<div style="padding:10px 12px;color:#999;font-size:13px;">No matching tags found</div>';
        return;
    }

    let lastType = null;

    items.forEach(function (item) {

        if (item.type !== lastType) {
            const header = document.createElement("div");
            header.className = "tag-section-header";
            header.textContent = item.type === "CDATA"
                ? "★  CDATA Fields  —  most commonly changed"
                : "Other Fields";
            tagList.appendChild(header);
            lastType = item.type;
        }

        const row = document.createElement("div");
        row.className = "tag-item";

        row.innerHTML =
            '<span class="tag-badge ' + item.type.toLowerCase() + '">' + item.type + '</span>' +
            '<span class="tag-path">'  + item.displayPath + '</span>' +
            '<span class="tag-value" title="' + item.value + '">' + item.value + '</span>';

        row.addEventListener("click", function () {
            document.querySelectorAll(".tag-item.selected")
                .forEach(function (el) { el.classList.remove("selected"); });

            row.classList.add("selected");
            selectedTagNode = item.node;

            tagSearch.value = item.displayPath + "   →   " + item.value;
            tagList.innerHTML = "";
            tagListContainer.style.display = "none";

            resetModifyState();
        });

        tagList.appendChild(row);
    });
}


tagSearch.addEventListener("input", function () {

    if (flatTagList.length === 0) return;

    selectedTagNode = null;
    tagListContainer.style.display = "block";

    const query = this.value.toLowerCase().trim();

    if (query === "") {
        renderTagList(flatTagList);
        return;
    }

    const filtered = flatTagList.filter(function (item) {
        return (
            item.displayPath.toLowerCase().includes(query) ||
            item.value.toLowerCase().includes(query)
        );
    });

    renderTagList(filtered);
});


tagSearch.addEventListener("focus", function () {
    if (flatTagList.length === 0) return;
    const query = this.value.toLowerCase().trim();
    const filtered = query === ""
        ? flatTagList
        : flatTagList.filter(function (item) {
            return (
                item.displayPath.toLowerCase().includes(query) ||
                item.value.toLowerCase().includes(query)
            );
          });
    renderTagList(filtered);
    tagListContainer.style.display = "block";
});


document.addEventListener("click", function (e) {
    if (
        tagListContainer &&
        !tagListContainer.contains(e.target) &&
        e.target !== tagSearch
    ) {
        tagList.innerHTML = "";
        tagListContainer.style.display = "none";
    }
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

    if (!selectedTagNode) {
        alert("Select a tag from the list.");
        return;
    }

    const newValue = newValueInput.value.trim();
    if (newValue === "") {
        alert("Enter a value.");
        return;
    }

    const targetNode = selectedTagNode;

    const cdata = Array.from(targetNode.childNodes).find(n => n.nodeType === 4);
    if (cdata) {
        cdata.nodeValue = newValue;
    } else {
        const textNode = Array.from(targetNode.childNodes).find(n => n.nodeType === 3);
        if (textNode) {
            textNode.nodeValue = newValue;
        } else {
            targetNode.textContent = newValue;
        }
    }

    const serializer = new XMLSerializer();
    modifiedXMLString = serializer.serializeToString(xmlDoc);

    let formatted = formatXML(serializer.serializeToString(selectedInstance));
    let escaped   = escapeHTML(formatted);

    const safeValue  = newValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const valueRegex = new RegExp(safeValue, "g");

    escaped = escaped.replace(
        valueRegex,
        '<span class="value-highlight">' + newValue + '</span>'
    );

    xmlPreview.innerHTML = escaped;

    newValueInput.value = "";
    downloadBtn.classList.remove("hidden");

    modifyBtn.textContent = "Done!";
    modifyBtn.style.background = "linear-gradient(135deg,#10b981,#22c55e)";

    // Rebuild list so updated value reflects immediately
    buildFlatTagList();
    tagSearch.value = "";
});


// =====================================================
// DOWNLOAD LOGIC
// =====================================================
downloadBtn.addEventListener("click", function () {

    if (!modifiedXMLString) return;

    let xmlContent = modifiedXMLString;

    if (!xmlContent.startsWith("<?xml")) {
        xmlContent =
            '<?xml version="1.0" encoding="UTF-16LE"?>\r\n' + xmlContent;
    } else {
        xmlContent = xmlContent.replace(/encoding="[^"]*"/, 'encoding="UTF-16LE"');
    }

    xmlContent = xmlContent.replace(/\r\n|\n/g, "\r\n");

    // No BOM — buffer is exactly 2 bytes per character, nothing extra
    const buffer = new ArrayBuffer(xmlContent.length * 2);
    const view   = new DataView(buffer);

    for (let i = 0; i < xmlContent.length; i++) {
        view.setUint16(i * 2, xmlContent.charCodeAt(i), true);
    }

    const blob = new Blob([buffer], { type: "application/xml;charset=UTF-16LE" });
    const url  = URL.createObjectURL(blob);

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
    const reg     = /(>)(<)(\/*)/g;
    let formatted = "";
    let pad       = 0;

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
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return "utf-16le";
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return "utf-16be";
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return "utf-8";
    if (bytes[1] === 0x00) return "utf-16le";
    if (bytes[0] === 0x00) return "utf-16be";
    return "utf-8";
}
