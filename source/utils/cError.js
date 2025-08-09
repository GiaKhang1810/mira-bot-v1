class cError extends Error {
    constructor(name, message) {
        if (message instanceof Error) {
            super(message.message);
            this.stack = message.stack;
        } else
            super(message);

        this.name = name;
    }
}

module.exports = cError;