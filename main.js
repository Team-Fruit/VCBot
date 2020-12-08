// ライブラリ読み込み
const textToSpeech = require('@google-cloud/text-to-speech')
const fs = require('fs')
const util = require('util')
const Discord = require("discord.js")
const crypto = require("crypto")
const { DH_NOT_SUITABLE_GENERATOR } = require('constants')

// いるやつ初期化
const Gclient = new textToSpeech.TextToSpeechClient()
const client = new Discord.Client()

// トークンをjsonから読み込み
const token = JSON.parse(fs.readFileSync('token.json', 'utf8')).token

var replaceWords = {}
try {
  //文字の読み替え一覧をjsonから読み込み
  replaceWords = JSON.parse(fs.readFileSync('replaceWords.json', 'utf8'))
} catch (e) {
  replaceWords = {}
}

String.prototype.bytes = function () {
  return (encodeURIComponent(this).replace(/%../g, "x").length);
}

//リストを表示するときに :を揃えたかった関数
function spacePadding(val) {

  let len = 20
  // for(i in replaceWords) {
  //   if(len < i.bytes()) len = i.bytes()
  // }

  //2バイト文字を検索
  m = val.match(/[^\x01-\x7E]/g,)
  if (m) {
    //文字数分余白を削除
    for (i in m) {
      // console.log(m[i])
      if (m[i]) console.log(m[i] + 'あ')
    }
  }
  for (var i = 0; i < 50; i++) {
    val = val + " ";
  }

  return val.slice(0, 20);
}

// 装飾文字を出力するときに書式が崩れないようにする関数
function escapeDecorationSymbol(val) {
  re = new RegExp(/([\*_~`\|/])/g)

  //装飾文字があったときはゼロ幅スペースを入れる
  // if (val.match(re)) val = val.replace(re,"\\$1​")
  if (val.match(re)) val = val.replace(re, "​$1")

  return val;
}

// 正規表現の記号をよけるための関数
function escape(val) {
  re = new RegExp(/([\*\|\^\.\+\?\|\\\[\]\(\)\{\}])/g)

  //記号があったときはバックスラッシュを入れる
  if (val.match(re)) val = val.replace(re, "\\$1​")

  return val;
}


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

  console.log(message.content)
  if (message.content.startsWith("/vcbot")) {
    const args = message.content.replace(/　+/g, " ").slice(6).trim().split(/ +/)
    switch (args[0]) {
      case 'replace':
        //読み替える文字とその読みがあるかをチェック
        if (!args[2]) {
          //ないときは送信者を煽る
          message.reply("なにいってんの？？？？？？？？？？？")
          return
        } else {

          if (replaceWords[args[1]]) {
            //入力された文字がすでに登録されているとき
            message.reply(args[1] + 'は重複していたので置き換えられました')
            if (message.deletable) message.delete()

          } else {
            message.reply(args[1] + ": " + args[2] + " :pencil:")
            if (message.deletable) message.delete()
          }
          //入力された文字と読みを登録(上書き)
          replaceWords[args[1]] = args[2]
          fs.writeFileSync('replaceWords.json', JSON.stringify(replaceWords));
          break;
        }
      case 'delete':
        if (!args[1]) {
          //消去内容が指定されなかったとき
          message.reply("無脳")
        } else {
          if (replaceWords[args[1]]) {
            //消去する文字が登録されているとき
            message.reply(args[1] + ": " + replaceWords[args[1]] + " :wave:")
            if (message.deletable) message.delete()

            //消去
            delete replaceWords[args[1]]
            fs.writeFileSync('replaceWords.json', JSON.stringify(replaceWords));
          } else {
            //登録されていなかったとき
            message.reply(args[1] + "  :arrow_left: :face_with_monocle: :question:")
            if (message.deletable) message.delete()
          }
        }
        break;
      case 'list':
        let mesBody = ""
        // リストの中身を組み立てる
        for (i in replaceWords) {
          mesBody = mesBody + "\n" + spacePadding(escapeDecorationSymbol(i), 10) + ": " + escapeDecorationSymbol(replaceWords[i])
        }
        // 無を吐き出さないためのif
        if (mesBody) {
          // フォントを変更する
          mesBody = "```" + mesBody + "```"
          message.reply(mesBody)
          console.log(mesBody)
          if (message.deletable) message.delete()
        }
        break;
      default:
        message.reply("？？？")
        break;
    }
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

  // try{
  // なんやらいろんな条件
  if (!newMember.member.user.bot && !(newMember.channelID !== connection.channel.id && oldMember.channelID !== connection.channel.id) && newMember.channelID !== oldMember.channelID) {

    // DisplayName(ニックネームを取得)
    let dn = newMember.member.displayName

    console.log(newMember.member.displayName)

    for (i in replaceWords) {
      let re = new RegExp(escape(i), 'g')
      dn = dn.replace(re, replaceWords[i])
    }

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
          client.channels.cache.get("411153104986177536").send(escapeDecorationSymbol(newMember.member.displayName).replace(/@/g, "＠") + " joined")
          // ジョインド
          connection.play("./joined.mp3")
        }
        else if ((oldMember.channelID === connection.channel.id) && (newMember.channelID === null || typeof newMember.channelID === 'undefined' || newMember.channelID !== connection.channel.id)) {
          // ログ
          client.channels.cache.get("411153104986177536").send(escapeDecorationSymbol(newMember.member.displayName).replace(/@/g, "＠") + " left")
          // リーブド
          connection.play("./leaved.mp3")
        }
      }
    })
  }
  // } catch(e) {
  // }
})

// Botにログイン
client.login(token)
