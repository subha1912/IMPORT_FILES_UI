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
const renameSection     = document.getElementById("renameSection");
const renameInput       = document.getElementById("renameInput");
const renameBtn         = document.getElementById("renameBtn");

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
    showRenameSection();
});


// =====================================================
// RENAME OBJECT (updates ObjectName + ExportData > Name)
// =====================================================

function showRenameSection() {
    if (selectedInstance) {
        renameSection.style.display = "block";
        const currentName = selectedInstance.getElementsByTagName("ObjectName")[0]?.textContent || "";
        renameInput.value = currentName;
    } else {
        renameSection.style.display = "none";
    }
}

renameBtn.addEventListener("click", function () {

    if (!selectedInstance) {
        alert("Select Object Type and Name first.");
        return;
    }

    const newName = renameInput.value.trim();
    if (newName === "") {
        alert("Enter a new name.");
        return;
    }

    const objectNameNode = selectedInstance.getElementsByTagName("ObjectName")[0];
    if (objectNameNode) {
        const cdata = Array.from(objectNameNode.childNodes).find(n => n.nodeType === 4);
        if (cdata) cdata.nodeValue = newName;
        else objectNameNode.textContent = newName;
    }

    const exportData = selectedInstance.querySelector("ExportData");
    if (exportData) {
        const nameNode = exportData.querySelector(":scope > Name, :scope > n");
        if (nameNode) {
            const cdata = Array.from(nameNode.childNodes).find(n => n.nodeType === 4);
            if (cdata) cdata.nodeValue = newName;
            else nameNode.textContent = newName;
        }
    }

    const serializer = new XMLSerializer();
    modifiedXMLString = serializer.serializeToString(xmlDoc);

    alert("Renamed successfully in both locations. You can now download.");
    downloadBtn.classList.remove("hidden");

    populateTypeDropdown();
    buildFlatTagList();
});


// =====================================================
// TAG SELECTION — TREE VIEW (parent/child aware)
// =====================================================

function buildFlatTagList() {

    selectedTagNode = null;
    tagSearch.value = "";
    tagSearch.disabled = false;
    tagSearch.placeholder = "Filter tags...";

    if (!selectedInstance) return;

    const exportData = selectedInstance.querySelector("ExportData");
    if (!exportData) return;

    renderTree(exportData, tagList, "");
    tagListContainer.style.display = "block";
}

function getLeafValue(node) {
    const cdata = Array.from(node.childNodes).find(n => n.nodeType === 4);
    if (cdata) return { value: cdata.nodeValue, type: "CDATA" };
    const text = Array.from(node.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim() !== "");
    if (text) return { value: text.nodeValue.trim(), type: "VALUE" };
    return null;
}

function renderTree(node, container, ancestorPath, filterQuery) {

    container.innerHTML = "";
    const skipTags = ["ExportData", "BaseExportData"];
    const children = Array.from(node.children);

    children.forEach(function (child) {

        const currentPath = skipTags.includes(child.tagName)
            ? ancestorPath
            : (ancestorPath ? ancestorPath + " > " + child.tagName : child.tagName);

        const leaf = getLeafValue(child);
        const hasChildren = child.children.length > 0;

        if (!hasChildren) {

            if (!leaf || leaf.value === "") return;

            if (filterQuery &&
                !currentPath.toLowerCase().includes(filterQuery) &&
                !leaf.value.toLowerCase().includes(filterQuery)) return;

            const row = document.createElement("div");
            row.className = "tag-item";
            row.innerHTML =
                '<span class="tag-badge ' + leaf.type.toLowerCase() + '">' + leaf.type + '</span>' +
                '<span class="tag-path" title="' + currentPath + '">' + currentPath + '</span>' +
                '<span class="tag-value" title="' + leaf.value + '">' + leaf.value + '</span>';

            row.addEventListener("click", function () {
                document.querySelectorAll(".tag-item.selected")
                    .forEach(el => el.classList.remove("selected"));
                row.classList.add("selected");
                selectedTagNode = child;
                tagSearch.value = currentPath + "   →   " + leaf.value;
                resetModifyState();
            });

            container.appendChild(row);

        } else {

            const branchHasMatch = !filterQuery || branchMatches(child, filterQuery);
            if (!branchHasMatch) return;

            const details = document.createElement("details");
            details.open = !!filterQuery;
            details.style.marginLeft = "12px";

            const summary = document.createElement("summary");
            summary.textContent = child.tagName;
            summary.style.cursor = "pointer";
            summary.style.fontSize = "13px";
            summary.style.color = "var(--text-secondary)";
            summary.style.padding = "4px 0";

            details.appendChild(summary);
            container.appendChild(details);

            renderTree(child, details, currentPath, filterQuery);
        }
    });
}

function branchMatches(node, query) {
    const children = Array.from(node.children);
    if (children.length === 0) {
        const leaf = getLeafValue(node);
        if (!leaf) return false;
        return node.tagName.toLowerCase().includes(query) ||
               leaf.value.toLowerCase().includes(query);
    }
    return children.some(c => branchMatches(c, query));
}


tagSearch.addEventListener("input", function () {
    if (!selectedInstance) return;
    const exportData = selectedInstance.querySelector("ExportData");
    const query = this.value.toLowerCase().trim();
    renderTree(exportData, tagList, "", query);
    tagListContainer.style.display = "block";
});

tagSearch.addEventListener("focus", function () {
    if (!selectedInstance) return;
    const exportData = selectedInstance.querySelector("ExportData");
    const query = this.value.toLowerCase().trim();
    renderTree(exportData, tagList, "", query);
    tagListContainer.style.display = "block";
});


document.addEventListener("click", function (e) {
    if (
        tagListContainer &&
        !tagListContainer.contains(e.target) &&
        e.target !== tagSearch
    ) {
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
