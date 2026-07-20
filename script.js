// // =====================================================
// // GLOBAL STATE
// // =====================================================

// let xmlDoc = null;
// let originalFileName = "";
// let rawText = "";          // FIX: store original decoded string — used for export
// let modifiedXMLString = "";
// let selectedInstance = null;
// let tagIndex = [];

// let fullPreviewContent = "";
// let isExpanded = false;

// let fileHistory = JSON.parse(localStorage.getItem("history")) || [];

// // tag selection state
// let selectedTagNode = null;
// let flatTagList = [];


// // =====================================================
// // DOM REFERENCES
// // =====================================================

// const fileInput         = document.getElementById("xmlFile");
// const typeDropdown      = document.getElementById("typeDropdown");
// const nameDropdown      = document.getElementById("nameDropdown");
// const newValueInput     = document.getElementById("newValue");
// const modifyBtn         = document.getElementById("modifyBtn");
// const downloadBtn       = document.getElementById("downloadBtn");
// const xmlPreview        = document.getElementById("xmlPreview");
// const historyList       = document.getElementById("historyList");
// const togglePreviewBtn  = document.getElementById("togglePreviewBtn");
// const clearHistoryBtn   = document.getElementById("clearHistoryBtn");
// const tagSearch         = document.getElementById("tagSearch");
// const tagListContainer  = document.getElementById("tagListContainer");
// const tagList           = document.getElementById("tagList");

// renderHistory();


// // =====================================================
// // UI STATE HELPERS
// // =====================================================

// function resetModifyState() {
//     modifyBtn.textContent = "Modify XML";
//     modifyBtn.style.background = "";
//     downloadBtn.classList.add("hidden");
// }

// function resetTagField() {
//     selectedTagNode = null;
//     flatTagList = [];
//     tagSearch.value = "";
//     tagSearch.disabled = true;
//     tagListContainer.style.display = "none";
//     tagList.innerHTML = "";
// }

// function resetUI() {
//     selectedInstance = null;

//     typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
//     nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
//     nameDropdown.disabled = true;

//     resetTagField();

//     newValueInput.value = "";
//     downloadBtn.classList.add("hidden");
// }

// newValueInput.addEventListener("input", resetModifyState);


// // =====================================================
// // FILE UPLOAD
// // =====================================================

// fileInput.addEventListener("change", function (event) {

//     resetUI();

//     const file = event.target.files[0];
//     if (!file) return;

//     originalFileName = file.name;

//     fileHistory.unshift(originalFileName);
//     fileHistory = [...new Set(fileHistory)];
//     if (fileHistory.length > 10) {
//         fileHistory = fileHistory.slice(0, 10);
//     }

//     localStorage.setItem("history", JSON.stringify(fileHistory));
//     renderHistory();

//     const reader = new FileReader();

//     reader.onload = function (e) {

//         const buffer = e.target.result;
//         const bytes  = new Uint8Array(buffer);
//         const encoding = detectEncoding(bytes);

//         let text;
//         try {
//             text = new TextDecoder(encoding).decode(buffer);
//         } catch {
//             alert("File decoding failed.");
//             return;
//         }

//         // Strip BOM character if present
//         if (text.charCodeAt(0) === 0xFEFF) {
//             text = text.slice(1);
//         }

//         // Strip trailing null bytes (artefact from some Opcenter exports)
//         text = text.replace(/\u0000+$/, "");

//         if (text.includes("\u0000")) {
//             alert("Encoding mismatch detected — null bytes found mid-file.");
//             return;
//         }

//         // FIX 1: Store the raw decoded text — this is what we export later,
//         //         NOT the XMLSerializer output (which strips CDATA & adds xmlns).
//         rawText = text;

//         const parser = new DOMParser();
//         xmlDoc = parser.parseFromString(text, "application/xml");

//         const parseError = xmlDoc.querySelector("parsererror");
//         if (parseError) {
//             console.error(parseError.textContent);
//             alert("XML parsing failed.");
//             return;
//         }

//         xmlPreview.textContent = text;
//         populateTypeDropdown();
//     };

//     reader.readAsArrayBuffer(file);
// });


// // =====================================================
// // DROPDOWN LOGIC — TYPE & NAME
// // =====================================================

// function populateTypeDropdown() {

//     typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
//     nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
//     nameDropdown.disabled = true;
//     resetTagField();

//     const instances = xmlDoc.getElementsByTagName("CDOInstance");
//     const typeSet = new Set();

//     for (let i = 0; i < instances.length; i++) {
//         const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
//         if (typeNode) {
//             typeSet.add(typeNode.textContent.trim());
//         }
//     }

//     Array.from(typeSet).sort().forEach(type => {
//         const option = document.createElement("option");
//         option.value = type;
//         option.textContent = type;
//         typeDropdown.appendChild(option);
//     });
// }


// typeDropdown.addEventListener("change", function () {

//     const selectedType = typeDropdown.value;

//     nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
//     nameDropdown.disabled = true;
//     resetTagField();

//     if (!selectedType) return;

//     const instances = xmlDoc.getElementsByTagName("CDOInstance");
//     const nameSet = new Set();

//     for (let i = 0; i < instances.length; i++) {
//         const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
//         const nameNode = instances[i].getElementsByTagName("ObjectName")[0];

//         if (typeNode && nameNode && typeNode.textContent.trim() === selectedType) {
//             nameSet.add(nameNode.textContent.trim());
//         }
//     }

//     Array.from(nameSet).sort().forEach(name => {
//         const option = document.createElement("option");
//         option.value = name;
//         option.textContent = name;
//         nameDropdown.appendChild(option);
//     });

//     nameDropdown.disabled = false;
// });


// nameDropdown.addEventListener("change", function () {

//     const selectedType = typeDropdown.value;
//     const selectedName = nameDropdown.value;

//     resetTagField();

//     if (!selectedName) return;

//     const instances = xmlDoc.getElementsByTagName("CDOInstance");
//     selectedInstance = null;

//     for (let i = 0; i < instances.length; i++) {
//         const typeNode = instances[i].getElementsByTagName("ObjectTypeName")[0];
//         const nameNode = instances[i].getElementsByTagName("ObjectName")[0];

//         if (
//             typeNode && nameNode &&
//             typeNode.textContent.trim() === selectedType &&
//             nameNode.textContent.trim() === selectedName
//         ) {
//             selectedInstance = instances[i];
//             break;
//         }
//     }

//     if (!selectedInstance) return;

//     buildFlatTagList();
// });


// // =====================================================
// // TAG SELECTION — FLAT SEARCHABLE LIST
// // =====================================================

// function buildFlatTagList() {

//     flatTagList = [];
//     selectedTagNode = null;

//     if (!selectedInstance) return;

//     const exportData = selectedInstance.querySelector("ExportData");
//     if (!exportData) return;

//     walkNode(exportData, []);

//     // CDATA fields first, then plain VALUE fields
//     flatTagList.sort((a, b) => {
//         if (a.type === "CDATA" && b.type !== "CDATA") return -1;
//         if (a.type !== "CDATA" && b.type === "CDATA") return 1;
//         return 0;
//     });

//     // Add [0],[1] index to duplicate paths so user can tell them apart
//     const pathCount = {};
//     flatTagList.forEach(item => {
//         pathCount[item.path] = (pathCount[item.path] || 0) + 1;
//     });
//     const pathSeen = {};
//     flatTagList.forEach(item => {
//         if (pathCount[item.path] > 1) {
//             const idx = pathSeen[item.path] || 0;
//             item.displayPath = item.path + " [" + idx + "]";
//             pathSeen[item.path] = idx + 1;
//         } else {
//             item.displayPath = item.path;
//         }
//     });

//     tagSearch.disabled = false;
//     tagSearch.value = "";
//     tagSearch.placeholder = "Search by tag name or current value...";
//     renderTagList(flatTagList);
//     tagListContainer.style.display = "block";
// }


// function walkNode(node, ancestorPath) {

//     const skipTags = ["ExportData", "BaseExportData"];
//     const children = Array.from(node.children);

//     if (children.length === 0) {

//         let val  = null;
//         let type = null;

//         const cdataNode = Array.from(node.childNodes).find(n => n.nodeType === 4);
//         if (cdataNode) {
//             val  = cdataNode.nodeValue;
//             type = "CDATA";
//         } else {
//             const textNode = Array.from(node.childNodes).find(
//                 n => n.nodeType === 3 && n.nodeValue.trim() !== ""
//             );
//             if (textNode) {
//                 val  = textNode.nodeValue.trim();
//                 type = "VALUE";
//             }
//         }

//         if (val !== null && val !== "") {
//             const path = [...ancestorPath, node.tagName].join(" > ");
//             flatTagList.push({
//                 path:        path,
//                 displayPath: path,
//                 value:       val,
//                 type:        type,
//                 node:        node
//             });
//         }

//     } else {
//         const newPath = skipTags.includes(node.tagName)
//             ? ancestorPath
//             : [...ancestorPath, node.tagName];

//         children.forEach(child => walkNode(child, newPath));
//     }
// }


// function renderTagList(items) {

//     tagList.innerHTML = "";

//     if (items.length === 0) {
//         tagList.innerHTML =
//             '<div style="padding:10px 12px;color:#999;font-size:13px;">No matching tags found</div>';
//         return;
//     }

//     let lastType = null;

//     items.forEach(function (item) {

//         if (item.type !== lastType) {
//             const header = document.createElement("div");
//             header.className = "tag-section-header";
//             header.textContent = item.type === "CDATA"
//                 ? "★  CDATA Fields  —  most commonly changed"
//                 : "Other Fields";
//             tagList.appendChild(header);
//             lastType = item.type;
//         }

//         const row = document.createElement("div");
//         row.className = "tag-item";

//         row.innerHTML =
//             '<span class="tag-badge ' + item.type.toLowerCase() + '">' + item.type + '</span>' +
//             '<span class="tag-path">'  + item.displayPath + '</span>' +
//             '<span class="tag-value" title="' + item.value + '">' + item.value + '</span>';

//         row.addEventListener("click", function () {
//             document.querySelectorAll(".tag-item.selected")
//                 .forEach(function (el) { el.classList.remove("selected"); });

//             row.classList.add("selected");
//             selectedTagNode = item.node;

//             tagSearch.value = item.displayPath + "   →   " + item.value;
//             tagList.innerHTML = "";
//             tagListContainer.style.display = "none";

//             resetModifyState();
//         });

//         tagList.appendChild(row);
//     });
// }


// tagSearch.addEventListener("input", function () {

//     if (flatTagList.length === 0) return;

//     selectedTagNode = null;
//     tagListContainer.style.display = "block";

//     const query = this.value.toLowerCase().trim();

//     if (query === "") {
//         renderTagList(flatTagList);
//         return;
//     }

//     const filtered = flatTagList.filter(function (item) {
//         return (
//             item.displayPath.toLowerCase().includes(query) ||
//             item.value.toLowerCase().includes(query)
//         );
//     });

//     renderTagList(filtered);
// });


// tagSearch.addEventListener("focus", function () {
//     if (flatTagList.length === 0) return;
//     const query = this.value.toLowerCase().trim();
//     const filtered = query === ""
//         ? flatTagList
//         : flatTagList.filter(function (item) {
//             return (
//                 item.displayPath.toLowerCase().includes(query) ||
//                 item.value.toLowerCase().includes(query)
//             );
//           });
//     renderTagList(filtered);
//     tagListContainer.style.display = "block";
// });


// document.addEventListener("click", function (e) {
//     if (
//         tagListContainer &&
//         !tagListContainer.contains(e.target) &&
//         e.target !== tagSearch
//     ) {
//         tagList.innerHTML = "";
//         tagListContainer.style.display = "none";
//     }
// });


// // =====================================================
// // MODIFY LOGIC
// // =====================================================

// modifyBtn.addEventListener("click", function () {

//     if (!xmlDoc) {
//         alert("Upload XML first.");
//         return;
//     }

//     if (!selectedInstance) {
//         alert("Select Object Type and Name first.");
//         return;
//     }

//     if (!selectedTagNode) {
//         alert("Select a tag from the list.");
//         return;
//     }

//     const newValue = newValueInput.value.trim();
//     if (newValue === "") {
//         alert("Enter a value.");
//         return;
//     }

//     const targetNode = selectedTagNode;
//     const tagName    = targetNode.tagName;

//     // Get the current (old) value before mutating
//     const cdataNode = Array.from(targetNode.childNodes).find(n => n.nodeType === 4);
//     const oldValue  = cdataNode
//         ? cdataNode.nodeValue
//         : (Array.from(targetNode.childNodes).find(
//               n => n.nodeType === 3 && n.nodeValue.trim() !== ""
//           ) || { nodeValue: "" }).nodeValue.trim();

//     // --- Mutate the DOM (keeps preview + dropdowns in sync) ---
//     if (cdataNode) {
//         cdataNode.nodeValue = newValue;
//     } else {
//         const textNode = Array.from(targetNode.childNodes).find(n => n.nodeType === 3);
//         if (textNode) {
//             textNode.nodeValue = newValue;
//         } else {
//             targetNode.textContent = newValue;
//         }
//     }

//     // FIX 2: Update rawText using string replacement instead of XMLSerializer.
//     //         This preserves CDATA wrappers, original formatting, and no xmlns injection.
//     if (cdataNode) {
//         // Replace CDATA value:  <TagName><![CDATA[oldValue]]></TagName>
//         //                    -> <TagName><![CDATA[newValue]]></TagName>
//         const cdataPattern = new RegExp(
//             "(<" + escapeRegex(tagName) + "[^>]*>)\\s*<!\\[CDATA\\[" +
//             escapeRegex(oldValue) +
//             "\\]\\]>\\s*(<\\/" + escapeRegex(tagName) + ">)",
//             ""   // first match only — safe because we target a specific old value
//         );
//         const cdataReplacement = "$1<![CDATA[" + newValue + "]]>$2";
//         const updated = rawText.replace(cdataPattern, cdataReplacement);

//         if (updated === rawText) {
//             // Fallback: try without attribute handling
//             const simpleCdata = "<" + tagName + "><![CDATA[" + oldValue + "]]></" + tagName + ">";
//             const simpleNew   = "<" + tagName + "><![CDATA[" + newValue + "]]></" + tagName + ">";
//             rawText = rawText.split(simpleCdata).join(simpleNew);  // replace first occurrence only via manual approach
//             // Actually replace only first occurrence:
//             const idx = rawText.indexOf(simpleCdata);
//             if (idx !== -1) {
//                 rawText = rawText.substring(0, idx) + simpleNew + rawText.substring(idx + simpleCdata.length);
//             }
//         } else {
//             rawText = updated;
//         }
//     } else {
//         // Replace plain text value: <TagName>oldValue</TagName>
//         const plainOld = "<" + tagName + ">" + oldValue + "</" + tagName + ">";
//         const plainNew = "<" + tagName + ">" + newValue + "</" + tagName + ">";
//         const idx = rawText.indexOf(plainOld);
//         if (idx !== -1) {
//             rawText = rawText.substring(0, idx) + plainNew + rawText.substring(idx + plainOld.length);
//         }
//     }

//     // FIX 3: Ensure the XML declaration has encoding="UTF-16LE"
//     rawText = rawText.replace(
//         /(<\?xml[^?]*?)encoding="[^"]*"/,
//         '$1encoding="UTF-16LE"'
//     );
//     if (!/encoding=/.test(rawText.substring(0, 100))) {
//         rawText = rawText.replace('<?xml', '<?xml encoding="UTF-16LE"');
//     }

//     // Update preview
//     let formatted = formatXML(
//         new XMLSerializer().serializeToString(selectedInstance)
//     );
//     let escaped = escapeHTML(formatted);

//     const safeValue  = newValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     const valueRegex = new RegExp(safeValue, "g");
//     escaped = escaped.replace(
//         valueRegex,
//         '<span class="value-highlight">' + newValue + '</span>'
//     );

//     xmlPreview.innerHTML = escaped;

//     newValueInput.value = "";
//     downloadBtn.classList.remove("hidden");

//     modifyBtn.textContent = "Done!";
//     modifyBtn.style.background = "linear-gradient(135deg,#10b981,#22c55e)";

//     // Rebuild list so updated value reflects immediately
//     buildFlatTagList();
//     tagSearch.value = "";
// });


// // =====================================================
// // DOWNLOAD LOGIC  — FIX 4: export rawText as UTF-16 LE
// // =====================================================

// downloadBtn.addEventListener("click", function () {

//     // Use rawText (string-replaced original) NOT XMLSerializer output.
//     // This guarantees: CDATA preserved, no xmlns added, correct declaration.
//     if (!rawText) return;

//     // FIX 5: Opcenter requires \n line endings only (not \r\n).
//     // Also remove any newline between the XML declaration and root element.
//     let xmlContent = rawText
//         .replace(/\r\n/g, "\n")           // normalise CRLF → LF throughout
//         .replace(/\r/g, "\n")             // normalise stray CR → LF
//         .replace(/(encoding="UTF-16LE"\?>)\n/, "$1"); // no newline after declaration

//     // Encode as UTF-16 LE with BOM
//     // BOM = 2 bytes (0xFF 0xFE), then 2 bytes per character
//     // ✅ FIXED CODE
// const buffer = new ArrayBuffer(xmlContent.length * 2 + 2); // +2 for trailing null
// const view   = new DataView(buffer);

// // No BOM written at all — start directly from position 0
// for (let i = 0; i < xmlContent.length; i++) {
//     view.setUint16(i * 2, xmlContent.charCodeAt(i), true);
//     //             ↑ now starts at position 0 — no BOM offset
// }
// // Last 2 bytes are already 0x00 0x00 automatically (ArrayBuffer always zero-fills)
// // This is the trailing null that Opcenter expects

//     const blob = new Blob([buffer], { type: "application/xml" });
//     const url  = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href     = url;
//     a.download = "modified_" + originalFileName;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
// });


// // =====================================================
// // PREVIEW LOGIC
// // =====================================================

// function showPreview(content) {

//     fullPreviewContent = content;
//     const lines = content.split("\n");

//     if (lines.length > 60) {
//         const previewText = lines.slice(0, 60).join("\n");
//         xmlPreview.textContent = previewText;
//         togglePreviewBtn.classList.remove("hidden");
//         togglePreviewBtn.textContent = "Read More";
//         xmlPreview.classList.add("collapsed");
//         xmlPreview.classList.remove("expanded");
//         isExpanded = false;
//     } else {
//         xmlPreview.textContent = content;
//         togglePreviewBtn.classList.add("hidden");
//     }
// }

// togglePreviewBtn.addEventListener("click", function () {
//     if (!isExpanded) {
//         xmlPreview.textContent = fullPreviewContent;
//         togglePreviewBtn.textContent = "Read Less";
//         xmlPreview.classList.remove("collapsed");
//         xmlPreview.classList.add("expanded");
//         isExpanded = true;
//     } else {
//         showPreview(fullPreviewContent);
//     }
// });


// // =====================================================
// // HISTORY LOGIC
// // =====================================================

// function renderHistory() {
//     historyList.innerHTML = "";
//     fileHistory.forEach(function (name) {
//         const li = document.createElement("li");
//         li.textContent = name;
//         historyList.appendChild(li);
//     });
// }

// if (clearHistoryBtn) {
//     clearHistoryBtn.addEventListener("click", function () {
//         fileHistory = [];
//         localStorage.removeItem("history");
//         renderHistory();
//     });
// }


// // =====================================================
// // UTILITIES
// // =====================================================

// function formatXML(xml) {
//     const PADDING = "  ";
//     const reg     = /(>)(<)(\/*)/g;
//     let formatted = "";
//     let pad       = 0;

//     xml = xml.replace(reg, "$1\r\n$2$3");
//     const lines = xml.split("\r\n");

//     for (let i = 0; i < lines.length; i++) {
//         let indent = 0;

//         if (lines[i].match(/^<\/\w/)) {
//             if (pad !== 0) pad -= 1;
//         } else if (lines[i].match(/^<\w[^>]*[^\/]>.*$/)) {
//             indent = 1;
//         }

//         formatted += PADDING.repeat(pad) + lines[i] + "\r\n";
//         pad += indent;
//     }

//     return formatted.trim();
// }

// function escapeHTML(str) {
//     return str
//         .replace(/&/g, "&amp;")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;");
// }

// function escapeRegex(str) {
//     return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// function detectEncoding(bytes) {
//     if (bytes[0] === 0xFF && bytes[1] === 0xFE) return "utf-16le";
//     if (bytes[0] === 0xFE && bytes[1] === 0xFF) return "utf-16be";
//     if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return "utf-8";
//     if (bytes[1] === 0x00) return "utf-16le";   // no BOM but UTF-16 LE pattern
//     if (bytes[0] === 0x00) return "utf-16be";
//     return "utf-8";
// }

// =====================================================
// BOOTSTRAP — dynamically load the engine files
// -----------------------------------------------------
// index.html only has <script src="script.js">, nothing was added
// for relationshipEngine.js / searchEngine.js / renameengine.js.
// Rather than touch index.html, we load them ourselves at runtime,
// in order, then start the app once all three are ready.
// =====================================================

// =====================================================
// BOOTSTRAP — dynamically load the engine files
// -----------------------------------------------------
// index.html only has <script src="script.js">, nothing was added
// for relationshipEngine.js / searchEngine.js / renameengine.js.
// Rather than touch index.html, we load them ourselves at runtime,
// in order, then start the app once all three are ready.
// =====================================================

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Failed to load " + src));
        document.head.appendChild(s);
    });
}

Promise.all([
    loadScript("relationshipEngine.js"),
    loadScript("searchEngine.js"),
    loadScript("renameengine.js")
]).then(function () {
    try {
        initApp();
    } catch (err) {
        console.error(err);
        alert("App failed to start: " + err.message);
    }
}).catch(function (err) {
    console.error(err);
    alert("Could not load engine scripts: " + err.message);
});

// Some browsers (notably when index.html is opened directly via file://
// rather than through a server) block localStorage entirely. Wrap all
// access so that only breaks file-history persistence, not the app.
function safeGetHistory() {
    try {
        return JSON.parse(localStorage.getItem("history")) || [];
    } catch (e) {
        console.warn("localStorage unavailable — file history will not persist.", e);
        return [];
    }
}

function safeSetHistory(list) {
    try {
        localStorage.setItem("history", JSON.stringify(list));
    } catch (e) {
        console.warn("localStorage unavailable — file history will not persist.", e);
    }
}


function initApp() {

// =====================================================
// GLOBAL STATE
// =====================================================

let xmlDoc = null;
let originalFileName = "";
let rawText = "";

let engine = null;         // RelationshipEngine instance
let searchEngine = null;   // SearchEngine instance
let renameEngine = null;   // RenameEngine instance

let relationshipMap = null;
let selectedObject = null;     // current object (from Type + Name dropdowns)
let selectedTagEntry = null;   // current tag row picked from the list

let fullPreviewContent = "";
let isExpanded = false;

let fileHistory = safeGetHistory();


// =====================================================
// DOM REFERENCES — only elements that already exist in index.html
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
    selectedTagEntry = null;
    tagSearch.value = "";
    tagSearch.disabled = true;
    tagListContainer.style.display = "none";
    tagList.innerHTML = "";
}

function resetUI() {
    selectedObject = null;

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

    safeSetHistory(fileHistory);
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

        text = text.replace(/\u0000+$/, "");

        if (text.includes("\u0000")) {
            alert("Encoding mismatch detected — null bytes found mid-file.");
            return;
        }

        rawText = text;

        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(text, "application/xml");

        const parseError = xmlDoc.querySelector("parsererror");
        if (parseError) {
            console.error(parseError.textContent);
            alert("XML parsing failed.");
            return;
        }

        xmlPreview.textContent = text;

        // ---- build the relationship graph instead of the old flat walk ----
        engine = new RelationshipEngine(xmlDoc);
        relationshipMap = engine.build();
        searchEngine = new SearchEngine(relationshipMap);
        renameEngine = new RenameEngine(engine);

        populateTypeDropdown();
    };

    reader.readAsArrayBuffer(file);
});


// =====================================================
// DROPDOWN LOGIC — TYPE & NAME (fully dynamic, no per-type branching)
// =====================================================

function populateTypeDropdown() {

    typeDropdown.innerHTML = '<option value="">Select Object Type</option>';
    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
    nameDropdown.disabled = true;
    resetTagField();

    engine.getAllObjectTypes().forEach(type => {
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
    selectedObject = null;

    if (!selectedType) return;

    engine.getObjectNamesForType(selectedType).forEach(name => {
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

    if (!selectedName) { selectedObject = null; return; }

    selectedObject = engine.getObjectByTypeAndName(selectedType, selectedName);
    if (!selectedObject) return;

    tagSearch.disabled = false;
    tagSearch.value = "";
    tagSearch.placeholder = "Search by tag name, path, or current value...";
    renderTagList(searchEngine.getTagsForObject(selectedObject));
    tagListContainer.style.display = "block";
});


// =====================================================
// TAG SELECTION — everything (context, editable state, reference
// warnings) is folded into the tag list rows and the search box
// itself, since that's the only place we're allowed to show it.
// =====================================================

function contextLine(item) {
    const ctx = engine.buildContext(item);
    const location = ctx.location.length ? ctx.location.join(" > ") : "(top level)";
    return "[" + ctx.objectType + "] " + ctx.objectName +
        (ctx.objectRevision ? " rev " + ctx.objectRevision : "") +
        "  |  " + location +
        "  |  editable: " + (ctx.editable ? "yes" : "no") +
        (ctx.isReference ? "  |  reference — edit via Modify to update linked copies too" : "");
}

function renderTagList(items) {

    tagList.innerHTML = "";

    if (items.length === 0) {
        tagList.innerHTML =
            '<div style="padding:10px 12px;color:#999;font-size:13px;">No matching tags found</div>';
        return;
    }

    let lastGroup = null;

    items.forEach(function (item) {
        const group = item.isIdentity ? "IDENTITY" : (item.isReference ? "REFERENCE" : item.type);
        if (group !== lastGroup) {
            const header = document.createElement("div");
            header.className = "tag-section-header";
            header.textContent =
                group === "IDENTITY"  ? "Object Identity — this is the real ObjectName" :
                group === "REFERENCE" ? "References — pointers to other objects" :
                group === "CDATA"     ? "CDATA Fields — most commonly changed" :
                                         "Other Fields";
            tagList.appendChild(header);
            lastGroup = group;
        }

        const row = document.createElement("div");
        row.className = "tag-item";
        if (!item.editable) row.style.opacity = "0.55";

        // reuse the existing .cdata / .value badge styles — reference and
        // read-only rows fall back to .value so nothing needs new CSS.
        const badgeClass = (item.type === "CDATA") ? "cdata" : "value";
        const badgeText = (item.isReference ? "REF " : "") + item.type + (item.editable ? "" : " 🔒");

        // context (object + location + editable) is folded straight into
        // the path text so it's visible without any extra panel.
        const pathWithContext = "[" + item.owner.objectType + "] " + item.owner.objectName +
            "  ›  " + item.displayPath;

        row.innerHTML =
            '<span class="tag-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '<span class="tag-path" title="' + contextLine(item) + '">' + pathWithContext + '</span>' +
            '<span class="tag-value" title="' + item.value + '">' + item.value + '</span>';

        row.addEventListener("click", function () {
            document.querySelectorAll(".tag-item.selected")
                .forEach(function (el) { el.classList.remove("selected"); });

            row.classList.add("selected");
            selectedTagEntry = item;

            // full context surfaced through the search box itself
            tagSearch.value = contextLine(item) + "   →   current: " + item.value;
            tagList.innerHTML = "";
            tagListContainer.style.display = "none";

            resetModifyState();
        });

        tagList.appendChild(row);
    });
}

tagSearch.addEventListener("input", function () {
    if (!selectedObject) return;
    selectedTagEntry = null;
    tagListContainer.style.display = "block";
    renderTagList(searchEngine.searchInObject(selectedObject, this.value));
});

tagSearch.addEventListener("focus", function () {
    if (!selectedObject) return;
    tagListContainer.style.display = "block";
    renderTagList(searchEngine.searchInObject(selectedObject, this.value));
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
// MODIFY / RENAME LOGIC
// -----------------------------------------------------
// No modal in the HTML, so the linked-reference choice uses a plain
// confirm() dialog — OK = update all linked references, Cancel =
// update only the selected tag. Same decision, no new markup.
// =====================================================

modifyBtn.addEventListener("click", function () {

    if (!xmlDoc) { alert("Upload XML first."); return; }
    if (!selectedObject) { alert("Select Object Type and Name first."); return; }
    if (!selectedTagEntry) { alert("Select a tag from the list."); return; }

    if (!selectedTagEntry.editable) {
        alert("This field is read-only in Opcenter Core and cannot be edited directly." +
              (selectedTagEntry.isReference ? " It is a reference to another object — edit the source object's name instead." : ""));
        return;
    }

    const newValue = newValueInput.value.trim();
    if (newValue === "") { alert("Enter a value."); return; }

    const plan = renameEngine.planUpdate(selectedTagEntry, newValue);

    if (plan.count === 0) {
        applyPlanAndRefresh(plan, "selected");
        return;
    }

    const updateAll = confirm(
        plan.count + " linked reference" + (plan.count === 1 ? "" : "s") + " found for \"" + plan.oldValue + "\".\n\n" +
        "OK  = update all " + plan.count + " linked references too\n" +
        "Cancel = update only this selected tag"
    );
    applyPlanAndRefresh(plan, updateAll ? "all" : "selected");
});

function applyPlanAndRefresh(plan, scope) {
    const result = renameEngine.apply(plan, scope);

    // ---- Refresh: XML, tag list, search results, relationship map ----
    relationshipMap = renameEngine.refreshRelationshipMap();
    searchEngine.setRelationshipMap(relationshipMap);

    const type = selectedObject.objectType;
    const name = plan.tagEntry.isRenameTarget ? plan.newValue : selectedObject.objectName;
    selectedObject = engine.getObjectByTypeAndName(type, name);

    if (plan.tagEntry.isRenameTarget) {
        populateNameDropdownKeepingType(type, name);
    }

    rawText = renameEngine.serializeXML(xmlDoc);

    let formatted = formatXML(rawText);
    let escaped = escapeHTML(formatted);
    const safeValue  = plan.newValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const valueRegex = new RegExp(safeValue, "g");
    escaped = escaped.replace(valueRegex, '<span class="value-highlight">' + plan.newValue + '</span>');
    xmlPreview.innerHTML = escaped;

    newValueInput.value = "";
    downloadBtn.classList.remove("hidden");
    modifyBtn.textContent = result.updatedCount > 1
        ? "Done! (" + result.updatedCount + " tags updated)"
        : "Done!";
    modifyBtn.style.background = "linear-gradient(135deg,#10b981,#22c55e)";

    if (selectedObject) {
        renderTagList(searchEngine.getTagsForObject(selectedObject));
        tagListContainer.style.display = "none";
    }
    selectedTagEntry = null;
    tagSearch.value = "";
}

function populateNameDropdownKeepingType(type, nameToSelect) {
    nameDropdown.innerHTML = '<option value="">Select Object Name</option>';
    engine.getObjectNamesForType(type).forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        if (name === nameToSelect) option.selected = true;
        nameDropdown.appendChild(option);
    });
}


// =====================================================
// DOWNLOAD LOGIC — export as UTF-16LE, matching Opcenter's format
// =====================================================

downloadBtn.addEventListener("click", function () {

    if (!rawText) return;

    let xmlContent = rawText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/(encoding="UTF-16LE"\?>)\n/, "$1");

    const buffer = new ArrayBuffer(xmlContent.length * 2 + 2); // +2 trailing null
    const view   = new DataView(buffer);

    for (let i = 0; i < xmlContent.length; i++) {
        view.setUint16(i * 2, xmlContent.charCodeAt(i), true);
    }

    const blob = new Blob([buffer], { type: "application/xml" });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href     = url;
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
        try { localStorage.removeItem("history"); } catch (e) { console.warn("localStorage unavailable.", e); }
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

} // end initApp