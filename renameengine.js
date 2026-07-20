// =====================================================
// renameEngine.js
// -----------------------------------------------------
// Responsibility: apply value changes to the live xmlDoc safely —
// whether that's a single plain field, or an ObjectName rename that
// fans out to every reference pointing at that object — then produce
// an export-ready XML string.
//
// Design note vs. the old script.js:
// The previous version patched `rawText` with regex string-replace
// (`<Tag>oldValue</Tag>` -> `<Tag>newValue</Tag>`). That only ever
// worked for a single, uniquely-textual node. It cannot safely handle
// "update all 31 linked references" in one operation, because many of
// those references share identical tag name + text (that's the whole
// problem the user hit). Instead, this engine mutates the actual DOM
// nodes (which are unambiguous object references, not text patterns)
// and then serializes the whole document back out, preserving CDATA
// sections and Opcenter's exact single-line, no-xmlns formatting.
// =====================================================

class RenameEngine {

    constructor(relationshipEngine) {
        this.engine = relationshipEngine;
    }

    // ---- planning (read-only — call before touching anything) ----------
    //
    // Works for ANY tag, not just ObjectName:
    //   - a plain leaf value with nothing pointing at it -> plan.count === 0,
    //     caller can just apply immediately, no prompt needed.
    //   - an ObjectName identity tag -> finds every reference elsewhere in
    //     the document whose __Id matches this object's ObjectInstanceId,
    //     plus internal same-object mirrors (Base/BaseExportData > Name)
    //     that currently hold the same text.
    planUpdate(tagEntry, newValue) {
        const object = tagEntry.objectRef;
        let linked = [];

        if (tagEntry.isRenameTarget) {
            linked = this.engine.getLinkedReferences(object)
                .filter(ref => ref.node !== tagEntry.node);

            object.tags.forEach(t => {
                if (t === tagEntry || t.node === tagEntry.node) return;
                if (t.isReference) return;
                if ((t.tagName === "__name" || t.tagName === "Name") &&
                    (t.value || "").trim() === (tagEntry.value || "").trim()) {
                    linked.push(t);
                }
            });
        }

        return {
            tagEntry,
            oldValue: tagEntry.value,
            newValue,
            linkedReferences: linked,
            count: linked.length
        };
    }

    // ---- applying ---------------------------------------------------------
    // scope: "selected" -> only tagEntry.node changes
    //        "all"      -> tagEntry.node + every plan.linkedReferences[].node change
    apply(plan, scope) {
        const targets = [plan.tagEntry];
        if (scope === "all") targets.push(...plan.linkedReferences);

        targets.forEach(entry => this._writeNodeValue(entry.node, plan.newValue));
        targets.forEach(entry => { entry.value = plan.newValue; });

        return {
            updatedCount: targets.length,
            scope
        };
    }

    _writeNodeValue(node, newValue) {
        const cdataNode = Array.from(node.childNodes).find(n => n.nodeType === 4);
        if (cdataNode) {
            cdataNode.nodeValue = newValue;
            return;
        }
        const textNode = Array.from(node.childNodes).find(n => n.nodeType === 3);
        if (textNode) {
            textNode.nodeValue = newValue;
        } else {
            node.textContent = newValue;
        }
    }

    // ---- refresh ------------------------------------------------------
    // Rebuild the relationship map from the (now-mutated) xmlDoc so the
    // UI's tag list / search results / linked-reference counts are all
    // consistent with what was just changed, without a page reload.
    refreshRelationshipMap() {
        return this.engine.build();
    }

    // ---- export ---------------------------------------------------------
    // Serialize xmlDoc back to a string, preserving CDATA sections,
    // self-closing empty elements, and no inserted whitespace/xmlns —
    // matching Opcenter's own export format exactly.
    serializeXML(xmlDoc) {
        const declNode = xmlDoc.firstChild && xmlDoc.firstChild.nodeType === 7 // PROCESSING_INSTRUCTION_NODE
            ? xmlDoc.firstChild
            : null;

        let out = declNode
            ? '<?xml ' + declNode.data.trim() + '?>'
            : '<?xml version="1.0" encoding="UTF-16LE"?>';

        out += this._serializeNode(xmlDoc.documentElement);
        return out;
    }

    _serializeNode(node) {
        switch (node.nodeType) {
            case 1: { // ELEMENT_NODE
                let out = "<" + node.tagName;
                Array.from(node.attributes || []).forEach(attr => {
                    out += " " + attr.name + '="' + this._escapeAttr(attr.value) + '"';
                });

                if (node.childNodes.length === 0) {
                    out += "/>";
                    return out;
                }

                out += ">";
                Array.from(node.childNodes).forEach(child => {
                    out += this._serializeNode(child);
                });
                out += "</" + node.tagName + ">";
                return out;
            }
            case 3: // TEXT_NODE
                return this._escapeText(node.nodeValue);
            case 4: // CDATA_SECTION_NODE
                return "<![CDATA[" + node.nodeValue + "]]>";
            default:
                return "";
        }
    }

    _escapeText(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    _escapeAttr(str) {
        return this._escapeText(str).replace(/"/g, "&quot;");
    }
}

window.RenameEngine = RenameEngine;