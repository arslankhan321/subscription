import shopifyCountries from "../../data/shopify_countries.json";

export const SHOPIFY_COUNTRIES = shopifyCountries;

export function getCountryOptions() {
    return Object.keys(SHOPIFY_COUNTRIES)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
            name,
            code: SHOPIFY_COUNTRIES[name].code,
            label: name,
        }));
}

export function getCountryByCode(countryCode) {
    if (!countryCode) {
        return null;
    }

    const code = String(countryCode).toUpperCase();
    const entry = Object.entries(SHOPIFY_COUNTRIES).find(
        ([, value]) => String(value.code || "").toUpperCase() === code
    );

    if (!entry) {
        return null;
    }

    return {
        name: entry[0],
        ...entry[1],
    };
}

export function getCountryByName(countryName) {
    if (!countryName) {
        return null;
    }

    const match = Object.entries(SHOPIFY_COUNTRIES).find(
        ([name]) => name.toLowerCase() === String(countryName).toLowerCase()
    );

    if (!match) {
        return null;
    }

    return {
        name: match[0],
        ...match[1],
    };
}

export function getCountryProvinces(countryCodeOrName) {
    const country =
        getCountryByCode(countryCodeOrName) || getCountryByName(countryCodeOrName);

    if (!country?.provinces || Object.keys(country.provinces).length === 0) {
        return [];
    }

    return Object.entries(country.provinces)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => ({
            name,
            code: value.code,
            label: name,
        }));
}

export function countryHasProvinces(countryCodeOrName) {
    return getCountryProvinces(countryCodeOrName).length > 0;
}

export function getProvinceLabel(countryCodeOrName) {
    const country =
        getCountryByCode(countryCodeOrName) || getCountryByName(countryCodeOrName);

    return country?.labels?.province || "State/Province";
}

export function getZipLabel(countryCodeOrName) {
    const country =
        getCountryByCode(countryCodeOrName) || getCountryByName(countryCodeOrName);

    return country?.labels?.zip || "ZIP code";
}

export function resolveProvinceCode(countryCode, provinceNameOrCode) {
    const provinces = getCountryProvinces(countryCode);

    if (!provinceNameOrCode) {
        return "";
    }

    const needle = String(provinceNameOrCode).toLowerCase();
    const match = provinces.find(
        (province) =>
            province.code.toLowerCase() === needle ||
            province.name.toLowerCase() === needle
    );

    return match?.code || "";
}
