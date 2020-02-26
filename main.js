const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const Gclient = new textToSpeech.TextToSpeechClient();

const Discord = require("discord.js");
const client = new Discord.Client();
const token = "your token";

const crypto = require("crypto");

let connection;

client.on("ready", () => {
    console.log("ready...");
});

client.on("message", message => {
    if (message.author.bot) {
        return;
    } else {
        let msg = message.content;
        let channel = message.channel;
        let author = message.author.username;

        if (message.mentions.has(client.user) && message.member.voice.channel) {
            message.member.voice.channel.join().then(c => {
                connection = c
                const dispatcher = connection.play("output.mp3");
            })
                .catch(console.log);
            return;
        }
    }
}
);

client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (typeof connection.channel === 'undefined') return

    if (!newMember.member.user.bot && !(newMember.channelID !== connection.channel.id && oldMember.channelID !== connection.channel.id) && newMember.channelID !== oldMember.channelID) {

        // The text to synthesize
        const dn = newMember.member.displayName;
        const request = {
            input: { text: dn },
            voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const sha512 = crypto.createHash('sha512');
        const hashobj = sha512.update(dn).digest('hex')

        try {
            fs.statSync('./mp3/' + hashobj + '.mp3');
        } catch (error) {
            if (error.code === 'ENOENT') {
                const [response] = await Gclient.synthesizeSpeech(request);
                const writeFile = util.promisify(fs.writeFile);
                await writeFile('./mp3/' + hashobj + '.mp3', response.audioContent, 'binary');
            } else {
                console.log(error);
            }
        }
        const dispatcher = connection.play('./mp3/' + hashobj + '.mp3')
        dispatcher.on('end', reason => {
            if ((oldMember.channelID === null || typeof oldMember.channelID === 'undefined' || oldMember.channelID !== connection.channel.id) && (newMember.channelID === connection.channel.id)) {
                connection.play("joined.mp3")
            }
            else if ((oldMember.channelID === connection.channel.id) && (newMember.channelID === null || typeof newMember.channelID === 'undefined' || newMember.channelID !== connection.channel.id)) {
                connection.play("leaved.mp3")
            }
        });
    }

}
);
client.login(token);