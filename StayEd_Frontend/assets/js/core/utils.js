/**
 * ============================================
 * StayEd
 * Utilities
 * ============================================
 */

class Utils {

    static qs(selector, scope = document) {

        return scope.querySelector(selector);

    }

    static qsa(selector, scope = document) {

        return [...scope.querySelectorAll(selector)];

    }

    static create(tag, className = "") {

        const element = document.createElement(tag);

        if (className) {

            element.className = className;

        }

        return element;

    }

    static show(element) {

        if (!element) return;

        element.classList.remove("st-hidden");

    }

    static hide(element) {

        if (!element) return;

        element.classList.add("st-hidden");

    }

    static toggle(element) {

        if (!element) return;

        element.classList.toggle("st-hidden");

    }

    static enable(button) {

        if (!button) return;

        button.disabled = false;

    }

    static disable(button) {

        if (!button) return;

        button.disabled = true;

    }

    static formatDate(date) {

        return new Intl.DateTimeFormat(

            "en-PH",

            {

                year: "numeric",

                month: "long",

                day: "numeric"

            }

        ).format(new Date(date));

    }

    static formatDateTime(date) {

        return new Intl.DateTimeFormat(

            "en-PH",

            {

                dateStyle: "medium",

                timeStyle: "short"

            }

        ).format(new Date(date));

    }

    static capitalize(text = "") {

        return text

            .split(" ")

            .map(

                word =>

                    word.charAt(0).toUpperCase() +

                    word.slice(1).toLowerCase()

            )

            .join(" ");

    }

    static initials(name = "") {

        return name

            .split(" ")

            .map(word => word[0])

            .join("")

            .substring(0, 2)

            .toUpperCase();

    }

    static randomId(prefix = "st") {

        return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1000)}`;

    }

    static debounce(callback, delay = 300) {

        let timer;

        return (...args) => {

            clearTimeout(timer);

            timer = setTimeout(() => {

                callback(...args);

            }, delay);

        };

    }

    static sleep(milliseconds) {

        return new Promise(resolve => {

            setTimeout(resolve, milliseconds);

        });

    }

    static copy(text) {

        navigator.clipboard.writeText(text);

    }

    static scrollTop() {

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }

    static isEmpty(value) {

        return (

            value === null ||

            value === undefined ||

            value === ""

        );

    }

    static empty(element) {

        if (!element) return;

        element.innerHTML = "";

    }

    static serialize(form) {

        const data = {};

        new FormData(form).forEach(

            (value, key) => {

                data[key] = value;

            }

        );

        return data;

    }

}

/**
 * ============================================
 * StayEd
 * Utilities
 * ============================================
 */

Object.assign(Utils, {

    storage: {

        set(key, value) {

            localStorage.setItem(

                key,

                JSON.stringify(value)

            );

        },

        get(key, fallback = null) {

            try {

                const value = localStorage.getItem(key);

                return value

                    ? JSON.parse(value)

                    : fallback;

            }

            catch {

                return fallback;

            }

        },

        remove(key) {

            localStorage.removeItem(key);

        },

        clear() {

            localStorage.clear();

        }

    },

    session: {

        set(key, value) {

            sessionStorage.setItem(

                key,

                JSON.stringify(value)

            );

        },

        get(key, fallback = null) {

            try {

                const value = sessionStorage.getItem(key);

                return value

                    ? JSON.parse(value)

                    : fallback;

            }

            catch {

                return fallback;

            }

        },

        remove(key) {

            sessionStorage.removeItem(key);

        },

        clear() {

            sessionStorage.clear();

        }

    },

    formatNumber(number = 0) {

        return new Intl.NumberFormat(

            "en-PH"

        ).format(number);

    },

    formatCurrency(amount = 0) {

        return new Intl.NumberFormat(

            "en-PH",

            {

                style: "currency",

                currency: "PHP"

            }

        ).format(amount);

    },

    percentage(value, total) {

        if (!total) {

            return 0;

        }

        return ((value / total) * 100).toFixed(1);

    },

    email(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    },

    phone(number) {

        return /^(09|\+639)\d{9}$/.test(number);

    },

    required(value) {

        return !this.isEmpty(value);

    },

    uuid() {

        return crypto.randomUUID();

    },

    query(name) {

        return new URLSearchParams(

            window.location.search

        ).get(name);

    },

    redirect(url) {

        window.location.href = url;

    },

    download(filename, content) {

        const blob = new Blob(

            [content],

            {

                type: "text/plain"

            }

        );

        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);

        link.download = filename;

        link.click();

        URL.revokeObjectURL(link.href);

    },

    avatarColor(text = "") {

        const colors = [

            "#12355B",

            "#006A68",

            "#0D47A1",

            "#6A1B9A",

            "#EF6C00",

            "#2E7D32",

            "#AD1457"

        ];

        let hash = 0;

        for (const char of text) {

            hash += char.charCodeAt(0);

        }

        return colors[hash % colors.length];

    }

});

/*
 * Toast convenience shim. Older modules call
 * Utils.toast(message, type); delegate to the Toast
 * manager when it's available, else fall back to console.
 */
Utils.toast = function (message, type = "info") {

    if (window.Toast && typeof Toast[type] === "function") {
        Toast[type](message);
        return;
    }

    if (window.Toast && typeof Toast.show === "function") {
        Toast.show(message, type);
        return;
    }

    console.log(`[toast:${type}] ${message}`);

};

window.Utils = Utils;

document.addEventListener(

    "DOMContentLoaded",

    () => {

        console.log(

            "%cStayEd Utilities Loaded",

            "color:#12355B;font-weight:bold;"

        );

    }

);