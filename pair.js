import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    
    if (!num) {
        return res.status(400).send({ code: 'Phone number is required.' });
    }

    let dirs = './' + num.replace(/[^0-9]/g, '');

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, '');
    const phone = pn('+' + num);

    if (!phone.valid) { 
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number.' });
        }
        return;
    }
    
    num = phone.number.e164.replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            let queenbella = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            queenbella.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log("✅ Connected successfully!");
                    
                    try {
                        const credsPath = dirs + '/creds.json';
                        const sessionKnight = fs.readFileSync(credsPath);
                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        // 1. Base64 String එක යැවීම
                        const base64Session = Buffer.from(sessionKnight).toString('base64');
                        await queenbella.sendMessage(userJid, { 
                            text: `*🔐 Queen Amdi Base64 Session String:*\n\n${base64Session}\n\n*⚠️ Warning: Do not share this text with anyone!*` 
                        });

                        // 2. creds.json ෆයිල් එක Document එකක් විදිහට යැවීම
                        await queenbella.sendMessage(userJid, {
                            document: sessionKnight,
                            mimetype: 'application/json',
                            fileName: 'creds.json',
                            caption: '📂 Here is your creds.json file.'
                        });

                        // 3. Image සහ අනිත් පණිවිඩ
                        await queenbella.sendMessage(userJid, {
                            image: { url: 'https://ibb.co/S4DVc63M' },
                            caption: `👑 *Queen Amdi* 👑\n\n🚀 New Commands + Fast AI Chat\n\n📁 Session File & Base64 Included\n\n©2026 Adam Inc. All rights reserved.`
                        });

                        await queenbella.sendMessage(userJid, {
                            text: `⚠️Do not share this file/string with anybody⚠️\n\n┌┤✑  Thanks for using QueenAmdi 👑\n│└────────────┈ ⳹\n│©2026 Adam Inc. All rights reserved.\n└─────────────────┈ ⳹\n\n`
                        });

                        setTimeout(async () => {
                            removeFile(dirs);
                            console.log("🧹 Session cleaned up.");
                        }, 10000);

                    } catch (error) {
                        console.error("❌ Error sending messages:", error);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) {
                        initiateSession();
                    }
                }
            });

            if (!queenbella.authState.creds.registered) {
                await delay(3000);
                try {
                    let code = await queenbella.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Failed to get pairing code.' });
                    }
                }
            }

            queenbella.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error('Error:', err);
        }
    }

    await initiateSession();
});

process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("Timed Out")) return;
    console.log('Caught exception: ', err);
});

export default router;
