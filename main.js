// ライブラリ読み込み
const textToSpeech = require('@google-cloud/text-to-speech')
const fs = require('fs')
const util = require('util')
const Discord = require("discord.js")
const crypto = require("crypto")

// いるやつ初期化
const Gclient = new textToSpeech.TextToSpeechClient()
const client = new Discord.Client()

// トークンをjsonから読み込み
const token = JSON.parse(fs.readFileSync('token.json', 'utf8')).token


let connection

// Discord Botの準備ができたら発火
client.on("ready", () => {
  console.log("ready...")
})

// メッセージが来たら発火
client.on("message", message => {
  // Botの時は処理を終了
  if (message.author.bot) {
    return
  }

  // メッセージにBotへのメンションを持ってる かつ 送信者がVCにいるとき
  if (message.mentions.has(client.user) && message.member.voice.channel) {
    // Botを接続させる
    message.member.voice.channel.join().then(c => {
      connection = c
      // 再生
      const dispatcher = connection.play("output.mp3")
      // メッセージを消す権限があるときに消す
      if (message.deletable) message.delete()
    })
      .catch(console.log)
  }
}
)

// VCの状態が変更されたら発火
client.on('voiceStateUpdate', async (oldMember, newMember) => {

  // なんやらいろんな条件
  if (!newMember.member.user.bot && !(newMember.channelID !== connection.channel.id && oldMember.channelID !== connection.channel.id) && newMember.channelID !== oldMember.channelID) {

    // DisplayName(ニックネームを取得)
    const dn = newMember.member.displayName

    // Google Text to Speechに渡すリクエストをあらかじめ生成
    const request = {
      input: { text: dn },
      voice: { name: 'ja-JP-Standard-A', languageCode: 'ja-JP', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    }

    // DisplayNameをハッシュする これ大丈夫なのか??
    const sha512 = crypto.createHash('sha512')
    const hashobj = sha512.update(dn).digest('hex')

    try {
      // ファイルがあるか確認
      fs.statSync('./mp3/' + hashobj + '.mp3')
    }
    // ないとき
    catch (error) {
      // ないとき
      if (error.code === 'ENOENT') {
        // Googleに音声を作ってもらう
        console.log("hei")
        const [response] = await Gclient.synthesizeSpeech(request)
        const writeFile = util.promisify(fs.writeFile)
        // 保存
        await writeFile('./mp3/' + hashobj + '.mp3', response.audioContent, 'binary')
      } else {
        //エラー
        console.log(error)
      }
    }

    //音声を再生
    const dispatcher = connection.play('./mp3/' + hashobj + '.mp3')
    // 再生が終わったら
    dispatcher.on('speaking', value => {
      if (!value) {
        if ((oldMember.channelID === null || typeof oldMember.channelID === 'undefined' || oldMember.channelID !== connection.channel.id) && (newMember.channelID === connection.channel.id)) {
          // ログを表示
          client.channels.cache.get("411153104986177536").send(dn.replace(/@/g, "＠") + " joined")
          // ジョインド
          connection.play("./joined.mp3")
        }
        else if ((oldMember.channelID === connection.channel.id) && (newMember.channelID === null || typeof newMember.channelID === 'undefined' || newMember.channelID !== connection.channel.id)) {
          // ログ
          client.channels.cache.get("411153104986177536").send(dn.replace(/@/g, "＠") + " left")
          // リーブド
          connection.play("./leaved.mp3")
        }
      }
    })
  }
})

// Botにログイン
client.login(token)
