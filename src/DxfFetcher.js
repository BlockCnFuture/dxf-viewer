import DxfParser from "./parser/DxfParser.js"

/** Fetches and parses DXF file. */
export class DxfFetcher {
    constructor(url, encoding = "utf-8") {
        this.url = url
        this.encoding = encoding
    }

    /** @param progressCbk {Function} (phase, receivedSize, totalSize) */
    async Fetch(progressCbk = null) {
        const response = await fetch(this.url)
        const totalSize = +response.headers.get('Content-Length')

        const reader = response.body.getReader()
        let receivedSize = 0
        //XXX streaming parsing is not supported in dxf-parser for now (its parseStream() method
        // just accumulates chunks in a string buffer before parsing. Fix it later.
        let buffer = "", first = true
        let decoder = new TextDecoder(this.encoding)
        while (true) {
            const { done, value } = await reader.read()

            if (first) {
                let text = decoder.decode(value, { stream: true })
                let match = text.match(/\$DWGCODEPAGE\s*\r?\n\s*\d+\r?\n\s*(\d+|\w+)/i)
                if (match?.[1]) {
                    let codepage = match[1].trim().toLowerCase()
                    let encoding = 'utf-8'
                    if (codepage === '936' || codepage === 'ansi_936' || codepage.includes('gb')) {
                        encoding = 'gbk'
                    } else if (codepage === '950' || codepage === 'ansi_950') {
                        encoding = 'big5'
                    }
                    if (this.encoding !== encoding) {
                        this.encoding = encoding
                        decoder = new TextDecoder(this.encoding)
                    }
                }
                first = false
            }

            if (done) {
                buffer += decoder.decode(new ArrayBuffer(0), { stream: false })
                break
            }

            buffer += decoder.decode(value, { stream: true })
            receivedSize += value.length
            if (progressCbk !== null) {
                progressCbk("fetch", receivedSize, totalSize)
            }
        }

        if (progressCbk !== null) {
            progressCbk("parse", 0, null)
        }
        const parser = new DxfParser()
        return parser.parseSync(buffer)
    }
}
