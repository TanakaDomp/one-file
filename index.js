const {
    makeWASocket,
    makeCacheableSignalKeyStore,
    downloadContentFromMessage,
    emitGroupParticipantsUpdate,
    emitGroupUpdate,
    generateWAMessageContent,
    generateWAMessage,
    makeInMemoryStore,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    MediaType,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    proto,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    getAggregateVotesInPollMessage,
    relayWAMessage,
    Browsers,
    GroupSettingChange,
    DisconnectReason,
    WASocket,
    getStream,
    WAProto,
    isBaileys,
    STORIES_JID,
    PHONENUMBER_MCC,
    AnyMessageContent,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    templateMessage,
    InteractiveMessage,
    Header,
    jidDecode,
    generateForwardMessageContent,
    fetchLatestWaWebVersion
} = require('@whiskeysockets/baileys');
const {
    exec,
    spawn,
    execSync
} = require("child_process")
const axios = require('axios');
const fs = require('fs');
const whois = require('whois-json');
const net = require('net');
const dns = require('dns').promises;
const crypto = require('crypto');
const chalk = require('chalk');
const cheerio = require('cheerio');
const FileType = require('file-type');
const FormData = require('form-data');
const Jimp = require("jimp");
const moment = require('moment-timezone');
const fetch = require('node-fetch');
const os = require('os');
const util = require('util');
const path = require('path');
const {
    URL
} = require('url');
const scrypt = util.promisify(crypto.scrypt);
const Boom = require('@hapi/boom');
const pino = require('pino');
const ExifReader = require('exifreader');
const {
    parse: parseMetadata
} = require('exiftool-vendored').exiftool;
const lolcatjs = require('lolcatjs');
const rateLimit = new Map();

// Konfigurasi
const ownerNumber = '6283841951316@s.whatsapp.net';
const pairingID = '6283841951316'
const usePairingCode = true
let isPublic = true;

// Vevek jir
const store = makeInMemoryStore({
    logger: pino().child({
        level: "silent",
        stream: "store"
    })
});

// Fungsi utilitas
const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

const getSystemInfo = () => {
    return {
        platform: os.platform(),
        cpu: os.cpus()[0].model,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        loadAverage: os.loadavg(),
        networkInterfaces: os.networkInterfaces()
    };
};

// WhatsApp Bot Integration
const startSock = async () => {
    const {
        state,
        saveCreds
    } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        printQRInTerminal: !usePairingCode,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true,
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
        version: (await (await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json')).json()).version,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: pino({
            level: 'fatal'
        }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino().child({
                level: 'silent',
                stream: 'store'
            })),
        }
    });

    if (usePairingCode && !sock.authState.creds.registered) {
        console.log(`Is connecting Number ${pairingID}\n`);
        await sleep(4000);
        const code = await sock.requestPairingCode(pairingID);
        console.log('Process...');
        console.log(`Your Pairing Code: ${chalk.yellow.bold((code))}`);
    }

    sock.ev.on('connection.update', async (update) => {
        const {
            connection,
            lastDisconnect
        } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                await startSock(); // Use await here
            } else {
                console.log('Connection closed');
            }
        }
        console.log('Connection update', update);
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async (upsert) => {
        sock.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {};
                return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
            } else {
                return jid;
            }
        };

        sock.sendText = (jid, text, quoted = '', options) => {
            sock.sendMessage(jid, {
                text: text,
                ...options
            }, {
                quoted
            })
        }
        sock.getFile = async (PATH, returnAsFilename) => {
            let res, filename;
            const data = Buffer.isBuffer(PATH) ?
                PATH :
                /^data:.*?\/.*?;base64,/i.test(PATH) ?
                Buffer.from(PATH.split`,` [1], 'base64') :
                /^https?:\/\//.test(PATH) ?
                await (res = await fetch(PATH)).buffer() :
                fs.existsSync(PATH) ?
                (filename = PATH, fs.readFileSync(PATH)) :
                typeof PATH === 'string' ?
                PATH :
                Buffer.alloc(0);

            if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');

            const type = await FileType.fromBuffer(data) || {
                mime: 'application/octet-stream',
                ext: '.bin'
            };

            if (data && returnAsFilename && !filename) {
                filename = path.join(__dirname, './' + new Date * 1 + '.' + type.ext);
                await fs.promises.writeFile(filename, data);
            }

            return {
                res,
                filename,
                ...type,
                data,
                deleteFile() {
                    return filename && fs.promises.unlink(filename);
                }
            };
        };
        sock.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
            let type = await sock.getFile(path, true);
            let {
                res,
                data: file,
                filename: pathFile
            } = type;

            if (res && res.status !== 200 || file.length <= 65536) {
                try {
                    throw {
                        json: JSON.parse(file.toString())
                    };
                } catch (e) {
                    if (e.json) throw e.json;
                }
            }

            let opt = {
                filename
            };
            if (quoted) opt.quoted = quoted;
            if (!type) options.asDocument = true;

            let mtype = '',
                mimetype = type.mime,
                convert;

            if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) {
                mtype = 'sticker';
            } else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) {
                mtype = 'image';
            } else if (/video/.test(type.mime)) {
                mtype = 'video';
            } else if (/audio/.test(type.mime)) {
                convert = await (ptt ? toPTT : toAudio)(file, type.ext);
                file = convert.data;
                pathFile = convert.filename;
                mtype = 'audio';
                mimetype = 'audio/ogg; codecs=opus';
            } else {
                mtype = 'document';
            }

            if (options.asDocument) mtype = 'document';

            let message = {
                ...options,
                caption,
                ptt,
                [mtype]: {
                    url: pathFile
                },
                mimetype
            };

            let m;
            try {
                m = await sock.sendMessage(jid, message, {
                    ...opt,
                    ...options
                });
            } catch (e) {
                console.error(e);
                m = null;
            } finally {
                if (!m) m = await sock.sendMessage(jid, {
                    ...message,
                    [mtype]: file
                }, {
                    ...opt,
                    ...options
                });
                return m;
            }
        }
        sock.downloadMediaMessage = async (message) => {
            let mime = (message.msg || message).mimetype || '';
            let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(message, messageType);
            let buffer = Buffer.from([]);

            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            return buffer;
        }
        sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
            let quoted = message.msg ? message.msg : message;
            let mime = (message.msg || message).mimetype || '';
            let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(quoted, messageType);
            let buffer = Buffer.from([]);

            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            let type = await FileType.fromBuffer(buffer);
            trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
            await fs.writeFileSync(trueFileName, buffer);

            return trueFileName;
        };
        const message = upsert.messages[0];
        if (!message.message) return;
        // SMSG NYOH
        const smsg = (sock, m, store) => {
            if (!m) return m
            let M = proto.WebMessageInfo
            if (m.key) {
                m.id = m.key.id
                m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16
                m.chat = m.key.remoteJid
                m.fromMe = m.key.fromMe
                m.isGroup = m.chat.endsWith('@g.us')
                m.sender = sock.decodeJid(m.fromMe && sock.user.id || m.participant || m.key.participant || m.chat || '')
                if (m.isGroup) m.participant = sock.decodeJid(m.key.participant) || ''
            }
            if (m.message) {
                m.mtype = getContentType(m.message)
                m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype])
                m.body = m.message.conversation || m.msg.caption || m.msg.text || (m.mtype == 'listResponseMessage') && m.msg.singleSelectReply.selectedRowId || (m.mtype == 'buttonsResponseMessage') && m.msg.selectedButtonId || (m.mtype == 'viewOnceMessage') && m.msg.caption || m.text
                let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
                m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
                if (m.quoted) {
                    let type = getContentType(quoted)
                    m.quoted = m.quoted[type]
                    if (['productMessage'].includes(type)) {
                        type = getContentType(m.quoted)
                        m.quoted = m.quoted[type]
                    }
                    if (typeof m.quoted === 'string') m.quoted = {
                        text: m.quoted
                    }
                    m.quoted.mtype = type
                    m.quoted.id = m.msg.contextInfo.stanzaId
                    m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat
                    m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false
                    m.quoted.sender = sock.decodeJid(m.msg.contextInfo.participant)
                    m.quoted.fromMe = m.quoted.sender === (sock.user && sock.user.id)
                    m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
                    m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
                    m.getQuotedObj = m.getQuotedMessage = async () => {
                        if (!m.quoted.id) return false
                        let q = await store.loadMessage(m.chat, m.quoted.id, sock)
                        return smsg(sock, q, store)
                    }
                    let vM = m.quoted.fakeObj = M.fromObject({
                        key: {
                            remoteJid: m.quoted.chat,
                            fromMe: m.quoted.fromMe,
                            id: m.quoted.id
                        },
                        message: quoted,
                        ...(m.isGroup ? {
                            participant: m.quoted.sender
                        } : {})
                    })

                    /**
                     * 
                     * @returns 
                     */
                    m.quoted.delete = () => sock.sendMessage(m.quoted.chat, {
                        delete: vM.key
                    })

                    /**
                     * 
                     * @param {*} jid 
                     * @param {*} forceForward 
                     * @param {*} options 
                     * @returns 
                     */
                    m.quoted.copyNForward = (jid, forceForward = false, options = {}) => sock.copyNForward(jid, vM, forceForward, options)

                    /**
                     *
                     * @returns
                     */
                    m.quoted.download = () => sock.downloadMediaMessage(m.quoted)
                }
            }
            if (m.msg.url) m.download = () => sock.downloadMediaMessage(m.msg)
            m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || ''
            /**
             * Reply to this message
             * @param {String|Object} text 
             * @param {String|false} chatId 
             * @param {Object} options 
             */
            m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? sock.sendMedia(chatId, text, 'file', '', m, {
                ...options
            }) : sock.sendText(chatId, text, m, {
                ...options
            })
            /**
             * Copy this message
             */
            m.copy = () => smsg(sock, M.fromObject(M.toObject(m)))

            /**
             * 
             * @param {*} jid 
             * @param {*} forceForward 
             * @param {*} options 
             * @returns 
             */
            m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => sock.copyNForward(jid, m, forceForward, options)

            return m
        }
        const m = smsg(sock, message, store);
        const from = message.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = message.key.participant || message.key.remoteJid;
        const pushname = m.pushName || "No Name";
        const isOwner = sender === ownerNumber;

        if (!isGroup && !isPublic && !isOwner) return;

        const groupMetadata = isGroup ? await sock.groupMetadata(from) : null;
        const groupAdmins = isGroup ? groupMetadata.participants.filter(participant => participant.isAdmin).map(admin => admin.jid) : [];
        const isAdmin = groupAdmins.includes(sender) || isOwner;

        const type = Object.keys(message.message)[0];
        const body = message.message.conversation || message.message[type].caption || message.message[type].text || '';

        if (!body.startsWith('!')) return;

        const command = body.slice(1).trim().split(' ')[0];
        const args = body.slice(1).trim().split(' ').slice(1);
        const text = q = args.join(" ");

        if (rateLimit.has(sender)) {
            const lastCommandTime = rateLimit.get(sender);
            if (Date.now() - lastCommandTime < 5000) {
                sock.sendMessage(from, {
                    text: `⏳ *Silakan tunggu sebelum menggunakan perintah lain.*`
                }, {
                    quoted: m
                });
                return;
            }
        }
        rateLimit.set(sender, Date.now());
        // Fungsi mengirim Media
        // Note: soalnya nanti nabrak kalo ga dibuat begini
        const sendVideoUrl = async (jid, url, caption = '', quoted) => {
            sock.sendMessage(jid, {
                video: {
                    url: url
                },
                caption: caption
            }, {
                quoted: quoted
            })
        }
        const sendVideo = async (jid, buffer, caption = '', quoted) => {
            sock.sendMessage(jid, {
                video: buffer,
                caption: caption
            }, {
                quoted: quoted
            })
        }
        const sendFotoUrl = async (jid, url, caption = '', quoted) => {
            sock.sendMessage(jid, {
                image: {
                    url: url
                },
                caption: caption
            }, {
                quoted: quoted
            })
        }
        const sendFoto = async (jid, buffer, caption = '', quoted) => {
            sock.sendMessage(jid, {
                image: buffer,
                caption: caption
            }, {
                quoted: quoted
            })
        }
        const sendAudioUrl = async (jid, url, quoted) => {
            sock.sendMessage(jid, {
                audio: {
                    url: url
                },
                mimetype: 'audio/mpeg',
                ptt: false,
            }, {
                quoted: quoted
            })
        }
        const sendAudio = async (jid, buffer, quoted) => {
            sock.sendMessage(jid, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: false,
            }, {
                quoted: quoted
            })
        }
        try {
            switch (command) {
                // Modified Owner
                case 'self':
                    if (isOwner) {
                        isPublic = false;
                        sock.sendMessage(from, {
                            text: `🔒 *Bot sekarang dalam mode privat*`
                        });
                    } else {
                        sock.sendMessage(from, {
                            text: `❌ *Anda tidak berhak menggunakan perintah ini*`
                        });
                    }
                    break;

                case 'public':
                    if (isOwner) {
                        isPublic = true;
                        sock.sendMessage(from, {
                            text: `🔓 *Bot sekarang dalam mode publik*`
                        });
                    } else {
                        sock.sendMessage(from, {
                            text: `❌ *Anda tidak berhak menggunakan perintah ini*`
                        });
                    }
                    break;
                case 'delhome':
                    if (!isOwner) return m.reply('Your not my owner!!');

                    let directoryPath = './'; // Ganti dengan path yang sesuai di dalam kontainer
                    fs.readdir(directoryPath, async function(err, files) {
                        if (err) {
                            return m.reply('Tidak dapat memindai direktori: ' + err);
                        }

                        let filteredArray = files.filter(item =>
                            item.endsWith("gif") || item.endsWith("png") ||
                            item.endsWith("mp3") || item.endsWith("mp4") ||
                            item.endsWith("jpg") || item.endsWith("jpeg") ||
                            item.endsWith("webp") || item.endsWith("webm") ||
                            item.endsWith("zip") || item.endsWith("tar.gz") ||
                            item.endsWith(".html") || item.endsWith(".rb") ||
                            item.endsWith(".java") || item.endsWith(".c") ||
                            item.endsWith(".cpp") || item.endsWith(".cs") ||
                            item.endsWith(".php") || item.endsWith(".ts") ||
                            item.endsWith(".go") || item.endsWith(".lua") ||
                            item.endsWith(".css") || item.endsWith(".txt")
                        );

                        let teks = `Terdeteksi ${filteredArray.length} file sampah\n\n`;
                        if (filteredArray.length === 0) return m.reply(teks);

                        for (let i = 0; i < filteredArray.length; i++) {
                            console.log("Nama file:", filteredArray[i]); // Tambahkan log untuk memeriksa nama file
                            let stats = fs.statSync(path.join(directoryPath, filteredArray[i]));
                            console.log("Stats:", stats); // Tambahkan log untuk memeriksa informasi stats

                            let fileSizeInBytes = stats.size;
                            let fileSize;

                            if (fileSizeInBytes < 1024) {
                                fileSize = `${fileSizeInBytes} Bytes`;
                            } else if (fileSizeInBytes < 1024 * 1024) {
                                fileSize = `${(fileSizeInBytes / 1024).toFixed(2)} KB`;
                            } else if (fileSizeInBytes < 1024 * 1024 * 1024) {
                                fileSize = `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
                            } else {
                                fileSize = `${(fileSizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                            }

                            teks += `${i + 1}. ${filteredArray[i]} - ${fileSize}\n`;
                        }
                        await sleep(2000);
                        m.reply("Menghapus file sampah...");

                        await Promise.all(filteredArray.map(async function(file) {
                            try {
                                await fs.unlinkSync(path.join(directoryPath, file));
                            } catch (err) {
                                console.error(err);
                            }
                        }));

                        await sleep(2000);
                        m.reply("Berhasil menghapus semua sampah");
                    });
                    break
                    // Music & downloader.
                case 'music':
                    if (!text) {
                        return m.reply(`Masukan Judulnya\n\nExample: ${prefix + command} Neck Deep - December`);
                    }
                    try {
                        const searchMusicResults = await fetchJson(`https://www.archive-ui.biz.id/search/soundcloud?q=${text}`);
                        m.reply('Loading...');
                        const MusicallyRs = searchMusicResults.result[0].url;
                        const scdl = require('soundcloud-downloader').default;
                        scdl.download(MusicallyRs).then(stream => {
                            stream.pipe(fs.createWriteStream('./soundcloud.mp3'));
                        });
                        await sleep(4000)
                        let buffMusic = fs.readFileSync('./soundcloud.mp3');
                        await sendAudio(from, buffMusic, m)

                        fs.unlinkSync('./soundcloud.mp3');

                    } catch (error) {
                        console.error('Error:', error);
                        return m.reply('Terjadi kesalahan saat memproses permintaan.');
                    }
                    break;
                case 'dl':
                    if (!text) return m.reply('Masukan Url!! ( Tiktok, Instagram, YouTube )\n\nConton: !dl https://vt.tiktok.com/xxxxxx')
                    if (text.startsWith('https://vt.tiktok.com/') || text.startsWith('https://www.tiktok.com/') || text.startsWith('https://t.tiktok.com/') || text.startsWith('https://vm.tiktok.com/')) {
                        let dataTiktok = await fetchJson(`https://www.archive-ui.biz.id/download/tiktok?url=${text}`);
                        await sendVideoUrl(from, dataTiktok.result.no_wm, dataTiktok.result.title, m)
                    }
                    if (text.startsWith('https://www.instagram.com/') || text.startsWith('https://www.instagram.com/reel/')) {
                        let dataInstagram = await fetchJson(`https://www.archive-ui.biz.id/download/instagram?url=${text}`);
                        for (let i of dataInstagram.result.url) {
                            sock.sendFile(m.chat, i, null, '', m);
                        }
                    }
                    break
                    // System Information
                case 'dor':
                    if (!m.isGroup) return m.reply('Perintah hanya tersedia dalam Group.');
                    if (!isAdmin && !isOwner) return m.reply('Only for Admins');

                    let blockwww = m.mentionedJid[0] ?
                        m.mentionedJid[0] :
                        m.quoted ?
                        m.quoted.sender :
                        text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

                    try {
                        await sock.groupParticipantsUpdate(m.chat, [blockwww], 'remove');
                        m.reply('*`Success`* Kick Member ✅');
                    } catch (err) {
                        m.reply(json(err));
                    }

                    break;
                case 'tag':
                    if (!isOwner) return m.reply('??');
                    let mem = m.isGroup ? await groupMetadata.participants.map(a => a.id) : "";

                    sock.sendMessage(m.chat, {
                        text: `@${m.chat} ${text}`,
                        contextInfo: {
                            mentionedJid: mem,
                            groupMentions: [{
                                groupSubject: `everyone`,
                                groupJid: m.chat,
                            }, ],
                        },
                    });
                    break;
                case 'system':
                    if (isOwner) {
                        const systemInfo = getSystemInfo();
                        sock.sendMessage(from, {
                            text: `🖥️ *Informasi Sistem:*\n\nPlatform: ${systemInfo.platform}\nCPU: ${systemInfo.cpu}\nTotal Memory: ${systemInfo.totalMemory}\nFree Memory: ${systemInfo.freeMemory}\nUptime: ${systemInfo.uptime}\nLoad Average: ${systemInfo.loadAverage}\nNetwork Interfaces: ${JSON.stringify(systemInfo.networkInterfaces, null, 2)}`
                        });
                    } else {
                        sock.sendMessage(from, {
                            text: `❌ *Anda tidak berhak menggunakan perintah ini*`
                        });
                    }
                    break;

                case 'menu':
                    const menu = `_LIST CMD :_

 ›› *self*
> Mode self: Bot hanya dapat digunakan oleh pemiliknya.

 ›› *public*
> Mode public: Bot dapat digunakan oleh semua orang.

 ›› *dor*
> Perintah dor: Mengeluarkan member yang bermasalah.

 ›› *dl*
> Perintah dl: Mengunduh media dari tautan yang diberikan.

 ›› *music*
> Perintah music: Memutar atau mencari musik.

 ›› *sc*
> Perintah sc: Mencari informasi melalui perintah khusus.

 ›› *delhome*
> Perintah delhome: Menghapus data di direktori home.

 ›› *tag*
> Perintah tag: Menandai semua anggota dalam grup.`;
                    sendFotoUrl(from, "https://files.catbox.moe/7k1gx9.jpg", menu, m)
                    break;
            }
        } catch (error) {
            console.error(`❌ *Error:* ${error.message}`);
            sock.sendMessage(from, {
                text: `❌ *Error:* ${error.message}`
            });
        }
    });
    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;
            const mek = chatUpdate.messages[0];

            if (!mek.message) return;
            mek.message =
                Object.keys(mek.message)[0] === 'ephemeralMessage' ?
                mek.message.ephemeralMessage.message :
                mek.message;

            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                let emoji = [
                    '💫', '😋', '🎉', '😮', '🎧', '💭', '🙏🏻', '🌟', '💤', '✨',
                ];
                let randomReact = emoji[Math.floor(Math.random() * emoji.length)];
                await sock.readMessages([mek.key]);
                sock.sendMessage(
                    'status@broadcast', {
                        react: {
                            text: randomReact,
                            key: mek.key
                        }
                    }, {
                        statusJidList: [mek.key.participant]
                    },
                );
            }

        } catch (err) {
            console.error(err);
        }
    })

    fs.existsSync('./auth_info.json') && sock.loadAuthInfo('./auth_info.json');
}

startSock();