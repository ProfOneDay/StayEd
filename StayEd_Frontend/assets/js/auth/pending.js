

class PendingPage {

    static init() {

        ComponentLoader.load();

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        PendingPage.init();

    }

);