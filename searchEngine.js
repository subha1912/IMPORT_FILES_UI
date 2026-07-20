// =====================================================
// searchEngine.js
// -----------------------------------------------------
// Responsibility: turn a relationshipMap into searchable,
// de-duplicated, display-ready tag lists. No UI code —
// script.js is the only place allowed to touch the DOM.
// =====================================================

class SearchEngine {

    constructor(relationshipMap) {
        this.setRelationshipMap(relationshipMap);
    }

    setRelationshipMap(relationshipMap) {
        this.relationshipMap = relationshipMap;
        this.allTags = this._flatten(relationshipMap);
    }

    // Flatten every object's tags into one list and add [0]/[1]-style
    // suffixes to displayPath when the same path repeats within an
    // object (e.g. multiple Transition > ToStep > __parent > __name).
    _flatten(relationshipMap) {
        const flat = [];
        relationshipMap.objects.forEach(object => {
            const pathCount = {};
            object.tags.forEach(t => { pathCount[t.path] = (pathCount[t.path] || 0) + 1; });

            const pathSeen = {};
            object.tags.forEach(t => {
                if (pathCount[t.path] > 1) {
                    const idx = pathSeen[t.path] || 0;
                    t.displayPath = t.path + " [" + idx + "]";
                    pathSeen[t.path] = idx + 1;
                } else {
                    t.displayPath = t.path;
                }
                flat.push(t);
            });
        });
        return flat;
    }

    // Full list for the currently selected object only (mirrors the old
    // per-instance tag list), CDATA-then-value ordering, identity fields
    // pinned to the very top so ObjectName is always visible first.
    getTagsForObject(object) {
        if (!object) return [];
        const tags = [...object.tags];
        tags.sort((a, b) => {
            if (a.isIdentity && !b.isIdentity) return -1;
            if (!a.isIdentity && b.isIdentity) return 1;
            if (a.type === "CDATA" && b.type !== "CDATA") return -1;
            if (a.type !== "CDATA" && b.type === "CDATA") return 1;
            return 0;
        });
        return tags;
    }

    // query against a specific object's tags (path, value, or tag name)
    searchInObject(object, query) {
        const tags = this.getTagsForObject(object);
        return this.filterTags(tags, query);
    }

    // query across the WHOLE export (every object)
    searchGlobal(query) {
        return this.filterTags(this.allTags, query);
    }

    filterTags(tags, query) {
        const q = (query || "").toLowerCase().trim();
        if (q === "") return tags;
        return tags.filter(t =>
            t.displayPath.toLowerCase().includes(q) ||
            (t.value || "").toLowerCase().includes(q) ||
            t.tagName.toLowerCase().includes(q) ||
            t.owner.objectName.toLowerCase().includes(q) ||
            t.owner.objectType.toLowerCase().includes(q)
        );
    }

    // convenience: search by object (type+name), independent of query text
    searchByObject(objectType, objectName) {
        return this.allTags.filter(t =>
            t.owner.objectType === objectType && t.owner.objectName === objectName
        );
    }

    searchByPath(pathFragment) {
        const p = (pathFragment || "").toLowerCase();
        return this.allTags.filter(t => t.path.toLowerCase().includes(p));
    }

    searchByValue(value) {
        const v = (value || "").toLowerCase();
        return this.allTags.filter(t => (t.value || "").toLowerCase().includes(v));
    }
}

window.SearchEngine = SearchEngine;