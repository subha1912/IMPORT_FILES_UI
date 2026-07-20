// =====================================================
// relationshipEngine.js
// -----------------------------------------------------
// Responsibility: understand the XML. Nothing else.
// No document.getElementById / innerHTML / addEventListener here.
//
// Generic detection rule (works for Workflow, Spec, Resource,
// Operation, and any future Opcenter object type without
// hardcoding a single type name):
//
//   Any element whose direct children include a `__name` node
//   (CDATA text) AND a sibling `__Id` (or `Id`) node is a
//   REFERENCE to another CDOInstance, identified by that
//   target's ObjectInstanceId. This holds true whether the
//   wrapping tag is called __parent, ParentResource, or
//   anything else — the shape is what matters, not the name.
//
//   Everything else that is a childless element with text/CDATA
//   content is a plain editable value tag.
// =====================================================

class RelationshipEngine {

    constructor(xmlDoc) {
        this.xmlDoc = xmlDoc;

        this.objects = [];               // one entry per <CDOInstance>
        this.referencesByName = new Map(); // targetNameText -> [tagEntry, ...]
        this.referencesById   = new Map(); // targetObjectInstanceId -> [tagEntry, ...]

        this._tagCounter = 0;
    }

    // ---- public entry point --------------------------------------------
    build() {
        this.objects = [];
        this.referencesByName.clear();
        this.referencesById.clear();
        this._tagCounter = 0;

        this.parseObjects();
        this._indexReferences();

        return this.getRelationshipMap();
    }

    getRelationshipMap() {
        return {
            objects: this.objects,
            referencesByName: this.referencesByName,
            referencesById: this.referencesById
        };
    }

    // ---- object discovery -------------------------------------------
    parseObjects() {
        const instances = Array.from(this.xmlDoc.getElementsByTagName("CDOInstance"));

        instances.forEach((instanceNode) => {
            const object = {
                objectType:       this._getFieldText(instanceNode, "ObjectTypeName"),
                objectName:       this._getFieldText(instanceNode, "ObjectName"),
                objectRevision:   this._getFieldText(instanceNode, "ObjectRevision"),
                objectInstanceId: this._getFieldText(instanceNode, "ObjectInstanceId"),
                rootNode:         instanceNode,
                exportData:       instanceNode.querySelector("ExportData"),
                tags:             [],
                references:       []
            };

            this.objects.push(object);
            this.discoverTags(object);
        });
    }

    // ---- tag discovery for one object ---------------------------------
    discoverTags(object) {
        // Identity fields (ObjectName / ObjectTypeName / ObjectRevision) sit
        // OUTSIDE <ExportData> as siblings of it. The old flat-list walker
        // never saw these because it only walked inside ExportData — that
        // was the root cause of "I can never find the real ObjectName".
        // Register them explicitly, at the top of the tag list.
        [
            { tag: "ObjectName", editable: true, isRenameTarget: true },
            { tag: "ObjectTypeName", editable: false, isRenameTarget: false },
            { tag: "ObjectRevision", editable: false, isRenameTarget: false }
        ].forEach(({ tag, editable, isRenameTarget }) => {
            const node = object.rootNode.getElementsByTagName(tag)[0];
            if (!node) return;
            const value = this._extractValue(node);
            if (value === null || value === "") return;

            object.tags.push(this._makeTagEntry({
                node, tagName: tag, value,
                type: this._hasCData(node) ? "CDATA" : "VALUE",
                pathParts: [tag],
                parentChain: [],
                object,
                isIdentity: true,
                isRenameTarget,
                editable
            }));
        });

        if (object.exportData) {
            this.walkNode(object.exportData, [], [], object);
        }
    }

    // Recursively walk a node inside ExportData, discovering leaf value
    // tags and reference nodes as it goes.
    walkNode(node, ancestorPathParts, parentChain, object) {
        const skipTags = ["ExportData", "Base", "BaseExportData"]; // wrapper tags, not shown in paths
        const children = Array.from(node.children);

        // Base/BaseExportData carry the object's OWN name+id as a self
        // mirror (used internally by Core, e.g. for revisioning) — they
        // happen to share the __name+__Id shape but are not a pointer to
        // a different object, so they must not be classified as a
        // reference (that would hide them from "update all linked").
        const refShape = skipTags.includes(node.tagName) ? null : this.detectReferenceShape(node);
        if (refShape) {
            const pathParts = [...ancestorPathParts, node.tagName];

            const refEntry = this._makeTagEntry({
                node: refShape.nameNode,
                tagName: "__name",
                value: refShape.value,
                type: this._hasCData(refShape.nameNode) ? "CDATA" : "VALUE",
                pathParts: [...pathParts, "__name"],
                parentChain,
                object,
                isReference: true,
                referenceWrapperTag: node.tagName,   // e.g. "__parent", "ParentResource"
                targetId: refShape.idValue,
                editable: false // references are edited via renameEngine, not directly
            });

            object.tags.push(refEntry);
            object.references.push(refEntry);

            // keep walking in case of nested reference chains (__parent > __parent),
            // just skip re-walking the __name/__Id leaves we already consumed
            children.forEach(child => {
                if (child === refShape.nameNode || child === refShape.idNode) return;
                this.walkNode(child, pathParts, [...parentChain, node.tagName], object);
            });
            return;
        }

        if (children.length === 0) {
            const value = this._extractValue(node);
            if (value !== null && value !== "") {
                const pathParts = [...ancestorPathParts, node.tagName];
                object.tags.push(this._makeTagEntry({
                    node, tagName: node.tagName, value,
                    type: this._hasCData(node) ? "CDATA" : "VALUE",
                    pathParts, parentChain, object,
                    editable: true
                }));
            }
            return;
        }

        const skip = skipTags.includes(node.tagName);
        const newPathParts   = skip ? ancestorPathParts : [...ancestorPathParts, node.tagName];
        const newParentChain = skip ? parentChain        : [...parentChain, node.tagName];
        children.forEach(child => this.walkNode(child, newPathParts, newParentChain, object));
    }

    // Structural reference detector — the generic rule described at the
    // top of the file. Returns null if `node` is not a reference wrapper.
    detectReferenceShape(node) {
        const children = Array.from(node.children);
        const nameNode = children.find(c => c.tagName === "__name");
        const idNode   = children.find(c => c.tagName === "__Id" || c.tagName === "Id");
        if (!nameNode || !idNode) return null;

        return {
            nameNode,
            idNode,
            value:   this._extractValue(nameNode),
            idValue: this._extractValue(idNode)
        };
    }

    detectEditable(tagEntry) {
        // References are never directly editable — they must go through
        // the rename engine so linked copies stay consistent.
        if (tagEntry.isReference) return false;
        // Type/Revision are structural identity, not free text in Core.
        if (tagEntry.tagName === "ObjectTypeName") return false;
        return true;
    }

    buildContext(tagEntry) {
        return {
            objectType:     tagEntry.owner.objectType,
            objectName:     tagEntry.owner.objectName,
            objectRevision: tagEntry.owner.objectRevision,
            location:       tagEntry.parentChain,
            tag:            tagEntry.tagName,
            currentValue:   tagEntry.value,
            editable:       tagEntry.editable,
            isReference:    tagEntry.isReference
        };
    }

    // After all objects are parsed, index every reference by the text it
    // points at AND (when resolvable) by the target's real ObjectInstanceId,
    // so renameEngine can look up "everything pointing at object X" in O(1).
    detectReferences() {
        this._indexReferences();
    }

    _indexReferences() {
        this.objects.forEach(object => {
            object.references.forEach(ref => {
                const nameKey = (ref.value || "").trim();
                if (nameKey) {
                    if (!this.referencesByName.has(nameKey)) this.referencesByName.set(nameKey, []);
                    this.referencesByName.get(nameKey).push(ref);
                }
                if (ref.targetId) {
                    if (!this.referencesById.has(ref.targetId)) this.referencesById.set(ref.targetId, []);
                    this.referencesById.get(ref.targetId).push(ref);
                }
            });
        });
    }

    // ---- lookups used by other engines ---------------------------------
    getObjectByTypeAndName(type, name) {
        return this.objects.find(o => o.objectType === type && o.objectName === name) || null;
    }

    getAllObjectTypes() {
        return Array.from(new Set(this.objects.map(o => o.objectType))).sort();
    }

    getObjectNamesForType(type) {
        return this.objects
            .filter(o => o.objectType === type)
            .map(o => o.objectName)
            .sort();
    }

    // Every reference tag (in any object, including possibly itself) whose
    // targetId matches this object's own ObjectInstanceId — i.e. every
    // place in the whole export that points AT this object.
    getLinkedReferences(object) {
        if (!object || !object.objectInstanceId) return [];
        return this.referencesById.get(object.objectInstanceId) || [];
    }

    // ---- low level helpers ----------------------------------------------
    _getFieldText(instanceNode, tag) {
        const node = instanceNode.getElementsByTagName(tag)[0];
        return node ? this._extractValue(node) : null;
    }

    _extractValue(node) {
        const cdata = Array.from(node.childNodes).find(n => n.nodeType === 4);
        if (cdata) return cdata.nodeValue;
        const text = Array.from(node.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim() !== "");
        return text ? text.nodeValue.trim() : null;
    }

    _hasCData(node) {
        return Array.from(node.childNodes).some(n => n.nodeType === 4);
    }

    _makeTagEntry({ node, tagName, value, type, pathParts, parentChain, object,
                     isReference = false, isIdentity = false, isRenameTarget = false,
                     referenceWrapperTag = null, targetId = null, editable = true }) {
        this._tagCounter += 1;
        const entry = {
            uid:        "t" + this._tagCounter,
            node, tagName, value, type,
            path:        pathParts.join(" > "),
            displayPath: pathParts.join(" > "), // de-duplicated with [n] suffixes by searchEngine/UI
            parentChain: [...parentChain],
            owner: {
                objectType:     object.objectType,
                objectName:     object.objectName,
                objectRevision: object.objectRevision
            },
            objectRef:  object,
            isReference,
            isIdentity,
            isRenameTarget,
            referenceWrapperTag,
            targetId,
            editable
        };
        entry.editable = this.detectEditable(entry) && editable;
        return entry;
    }
}

// exposed as a plain global — script.js loads this file with a
// classic <script> tag before script.js itself, no bundler required.
window.RelationshipEngine = RelationshipEngine;