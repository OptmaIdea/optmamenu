export type NavigationContextItem = {
    path: string;
    queryString?: string;
};

function matchesQuery(expectedQuery: string, actualSearch: string): boolean {
    const expected = new URLSearchParams(expectedQuery);
    const actual = new URLSearchParams(actualSearch);
    for (const [key, value] of expected) {
        if (actual.get(key) !== value) return false;
    }
    return true;
}

/** First prefer an exact route + contextual tab, then the generic route. */
export function findNavigationContext<T extends NavigationContextItem>(
    sections: Record<string, T[]>,
    pathname: string,
    search: string
): { group: string; item: T } | null {
    for (const [group, items] of Object.entries(sections)) {
        const item = items.find((candidate) =>
            candidate.path === pathname &&
            candidate.queryString &&
            matchesQuery(candidate.queryString, search)
        );
        if (item) return { group, item };
    }

    for (const [group, items] of Object.entries(sections)) {
        const item = items.find((candidate) =>
            candidate.path === pathname && !candidate.queryString
        );
        if (item) return { group, item };
    }

    for (const [group, items] of Object.entries(sections)) {
        const item = items.find((candidate) =>
            candidate.path !== '/admin' &&
            pathname.startsWith(candidate.path + '/') &&
            !candidate.queryString
        );
        if (item) return { group, item };
    }

    return null;
}

/** A generic link must not remain highlighted when a specific tab is selected. */
export function isNavigationContextActive<T extends NavigationContextItem>(
    sections: Record<string, T[]>,
    item: T,
    pathname: string,
    search: string
): boolean {
    const exactPath = pathname === item.path;
    const childPath = item.path !== '/admin' &&
        item.path !== '/admin/products' &&
        pathname.startsWith(item.path + '/');

    if (!exactPath && !childPath) return false;
    if (item.queryString) return matchesQuery(item.queryString, search);

    if (exactPath) {
        const hasMatchedTab = Object.values(sections).some((items) =>
            items.some((candidate) =>
                candidate.path === item.path &&
                candidate.queryString &&
                matchesQuery(candidate.queryString, search)
            )
        );
        if (hasMatchedTab) return false;
    }

    return true;
}
