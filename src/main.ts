// ライブラリ読み込み
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { readFileSync, writeFile, writeFileSync, statSync, existsSync } from "fs";
import { promisify } from "util";
import { createHash } from "crypto";
import { Client, Intents, TextChannel, Collection, Snowflake } from "discord.js";
import { 
  VoiceConnection, 
  joinVoiceChannel, 
  JoinVoiceChannelOptions, 
  CreateVoiceConnectionOptions, 
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { getConf, updateConf } from "./conf";
import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import { ChainSubscription } from "./utils";

// いるやつ初期化
const Gclient = new TextToSpeechClient();
const client = new Client(
  {intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ]});

// config移行

// トークンをconfigから読み込み
const token: string = getConf("token");

let replaceWords: {[target: string]: string} = {};
try {
  //文字の読み替え一覧をjsonから読み込み
  replaceWords = JSON.parse(readFileSync("replaceWords.json", "utf8"));
} catch (e) {
  replaceWords = {};
}

// PlayerとVoiceConnectionの関連を保存
let subscStore : Collection<Snowflake, ChainSubscription> = new Collection();

//リストを表示するときに :を揃えたかった関数
function spacePadding(val: string) {
  let len: number = 0;
  let i: string = "";
  let ii: string = "";

  // 置換対象で一番長い文字列を検索
  // 置換対象リストから一つずつ検索
  for (i in replaceWords) {
    // それぞれのバイト数をtempLenに格納
    let tempLen: number = i.length;
    for (ii in i.split("")) {
      // eslint-disable-next-line no-control-regex
      if (i[ii].match(/[^\x01-\x7E]/)) tempLen++;
    }
    // 一番大きいバイト数を記録
    if (len < tempLen) {
      len = tempLen;
    }
  }

  console.log(len);

  for (i in val.split("")) {
    //2バイト文字を検索してそのぶん空白を削る
    // eslint-disable-next-line no-control-regex
    if (val[i].match(/[^\x01-\x7E]/g)) len--;
  }

  for (let i = 0; i < 50; i++) {
    val = val + " ";
  }
  return val.substr(0, len);
}

let re;
// 装飾文字を出力するときに書式が崩れないようにする関数
function escapeDecorationSymbol(val: string) {
  // eslint-disable-next-line
  re = new RegExp(/([\*_~`\|/])/g);

  //装飾文字があったときはゼロ幅スペースを入れる
  // eslint-disable-next-line
  // if (val.match(re)) val = val.replace(re,"\\$1​")
  if (val.match(re)) val = val.replace(re, "​$1");

  return val;
}

// 正規表現の記号をよけるための関数
function escape(val: string) {
  // eslint-disable-next-line
  re = new RegExp(/([\*\|\^\.\+\?\|\\\[\]\(\)\{\}])/g);

  //記号があったときはバックスラッシュを入れる
  if (val.match(re)) val = val.replace(re, "\\$1​");

  return val;
}

// JSON.stringifyから""を取るための関数
function searchJSON(val: string) {
  // eslint-disable-next-line
  val = JSON.stringify(val).replace(/\"/g, "");
  return val;
}

let connection: VoiceConnection;

// Discord Botの準備ができたら発火
client.on("ready", () => {
  console.log("ready...");
});
// メッセージが来たら発火
client.on("messageCreate", (message) => {
  // Botの時は処理を終了
  if (message.author.bot) {
    return;
  }

  console.log(message.content);
  if (message.content.startsWith("/vcbot")) {
    // eslint-disable-next-line
    const args = message.content
      .replace(/　+/g, " ")
      .slice(6)
      .trim()
      .split(/ +/);

    const arrayLength = args.length;
    let inputWord = "";
    try {
      // argsの先頭を削除してそれ以外を連結して返す
      inputWord = args.slice(1, arrayLength).join(" ");
    } catch (e) {
      console.log(e);
    }

    switch (args[0]) {
      case "config":
        if (args.length < 2) {
          message.reply({
            content: "VCBot 設定のヘルプ\n" +
              "使い方: `/vcbot config サブコマンド ...`\n" +
              "\n" +
              "`/vcbot config`のコマンド及びサブコマンドの使用方法はそれ以降を何も書かずに実行することで参照可能です\n" +
              "__サブコマンド一覧__ \n" +
              "`view`: 設定内容を表示します\n" +
              "`set` : 設定を更新します"
            });
          // if (message.deletable) message.delete();
          break;
        } else {
          switch (args[1]) {
            case "view":
              if (args.length < 3) {
                message.reply(
                  {content: "使い方: `/vcbot config view 表示する設定項目`\n" +
                    "\n" +
                    "設定項目は`.`区切りでカテゴライズされています\n" +
                    "例: `/vcbot config view guild.logChannelId`\n" +
                    "\n" +
                    "次の設定項目・階層名が有効です: guild"}
                );
                // if (message.deletable) message.delete();
              } else {
                let prop_contexts = args[2].split(/\./);
                // parse
                switch (prop_contexts[0]) {
                  case "guild":
                    if (prop_contexts.length < 2) {
                      // help: guild
                      message.reply(
                        {content: "次の設定項目・階層名が有効です: `logChannelId`"}
                      );
                      // if (message.deletable) message.delete();
                      break;
                    }
                    prop_contexts[0] = "guilds." + message.guild!.id;
                    switch (prop_contexts[1]) {
                      case "logChannelId":
                        // eslint-disable-next-line no-case-declarations
                        const guild_logChannelId_help =
                          "設定項目の説明:VCBotが居るボイスチャットチャンネルでのユーザーの出入りを記録するテキストチャットチャンネルをIDで指定します\n";
                        // eslint-disable-next-line no-case-declarations
                        let prop_ctx = prop_contexts.join(".");
                        if (!getConf(prop_ctx)) {
                          message.reply(
                            {content: guild_logChannelId_help +
                              "この設定項目は設定されていません"}
                          );
                          // if (message.deletable) message.delete();
                        } else {
                          message.reply(
                            {content: guild_logChannelId_help +
                              "この設定項目は以下のように設定されています\n" +
                              getConf(prop_ctx)}
                          );
                          // if (message.deletable) message.delete();
                        }
                        break;
                      default:
                        message.reply(
                          {content: "入力されたコンテキストが正しくありません: 有効な設定項目、階層名ではありません"}
                        );
                        // if (message.deletable) message.delete();
                        break;
                    }
                    break;
                  default:
                    message.reply(
                      {content: "入力されたコンテキストが正しくありません: 有効な設定項目、階層名ではありません"}
                    );
                    // if (message.deletable) message.delete();
                    break;
                }
              }
              break;
            case "set":
              if (args.length < 3) {
                message.reply(
                  {content: "使い方: `/vcbot config set 設定する設定項目 設定`\n" +
                    "\n" +
                    "設定項目は`.`区切りでカテゴライズされています\n" +
                    "例: `/vcbot config set guild.logChannelId 314045904778952708`"}
                );
                // if (message.deletable) message.delete();
                break;
              } else if (args.length >= 3) {
                let prop_contexts = args[2].split(/\./);
                // parse
                switch (prop_contexts[0]) {
                  case "guild":
                    if (prop_contexts.length < 2) {
                      message.reply(
                        {content: "入力されたコンテキストが正しくありません: 設定項目ではありません"}
                      );
                      // if (message.deletable) message.delete();
                      break;
                    }
                    prop_contexts[0] = "guilds." + message.guild!.id;
                    switch (prop_contexts[1]) {
                      case "logChannelId":
                        if (args.length < 4) {
                          message.reply({content: "設定内容が正しく入力されていません"});
                          // if (message.deletable) message.delete();
                          break;
                        }
                        // eslint-disable-next-line no-case-declarations
                        let prop_ctx = prop_contexts.join(".");
                        updateConf(prop_ctx, args[3]);
                        message.reply(
                          {content: prop_ctx + "を" + args[3] + "に設定しました"}
                        );
                        // if (message.deletable) message.delete();

                        break;
                      default:
                        message.reply(
                          {content: "入力されたコンテキストが正しくありません: 有効な設定項目、階層名ではありません"}
                        );
                        // if (message.deletable) message.delete();
                        break;
                    }
                    break;
                  default:
                    message.reply(
                      {content: "入力されたコンテキストが正しくありません: 有効な設定項目、階層名ではありません"}
                    );
                    // if (message.deletable) message.delete();
                    break;
                }
              }
              break;
            default:
              message.reply(
                {content: "そのようなサブコマンドはありません\n" +
                  "使い方: `/vcbot config サブコマンド ...`\n" +
                  "\n" +
                  "`/vcbot config`のコマンド及びサブコマンドの使用方法はそれ以降を何も書かずに実行することで参照可能です\n" +
                  "__サブコマンド一覧__ \n" +
                  "`view`: 設定内容を表示します\n" +
                  "`set` : 設定を更新します"}
              );
              // if (message.deletable) message.delete();
              break;
          }
        }
        break;
      case "add":
        // 末尾にある読みを削除(最後の-1は空白を消すため)
        inputWord = inputWord.substr(
          0,
          inputWord.length - args[arrayLength - 1].length - 1
        );

        // 読み替える文字とその読みがあるかをチェック
        if (arrayLength >= 3) {
          // リストが崩れる・deleteコマンドで消せない原因になるので一部の記号をはじく
          // eslint-disable-next-line
          if (inputWord.match(/([`\\\*])/g)) {
            // eslint-disable-next-line
            message.reply({content: "` \\ ' の記号はつかえません"});
            // if (message.deletable) message.delete();
          } else {
            if (replaceWords[inputWord]) {
              // 入力された文字がすでに登録されているとき
              message.reply({content: inputWord + "は重複していたので置き換えられました"});
              // if (message.deletable) message.delete();
            } else {
              message.reply(
                {content: inputWord + ": " + args[arrayLength - 1] + " :pencil:"}
              );
              // if (message.deletable) message.delete();
            }

            //入力された文字と読みを登録(上書き)
            replaceWords[searchJSON(inputWord)] = args[arrayLength - 1];
            writeFileSync(
              "replaceWords.json",
              JSON.stringify(replaceWords, null, 2)
            );
          }
        } else {
          // ないときは送信者を煽る
          message.reply({content: "なにいってんの？？？？？？？？？？？"});
        }
        break;
      case "delete":
        if (!args[1]) {
          //消去内容が指定されなかったとき
          message.reply({content: "消去内容を指定してください"});
        } else {
          if (replaceWords[searchJSON(inputWord)]) {
            //消去する文字が登録されているとき
            message.reply(
              {content: inputWord + ": " + replaceWords[inputWord] + " :wave:"}
            );
            // if (message.deletable) message.delete();

            //消去
            delete replaceWords[searchJSON(inputWord)];
            writeFileSync(
              "replaceWords.json",
              JSON.stringify(replaceWords, null, 2)
            );
          } else {
            //登録されていなかったとき
            message.reply(
              {content: inputWord + "  :arrow_left: :face_with_monocle: :question:"}
            );
            // if (message.deletable) message.delete();
          }
        }
        break;
      case "list":
        // eslint-disable-next-line
        let mesBody;
        // eslint-disable-next-line
        let i;
        // リストの中身を組み立てる
        for (i in replaceWords) {
          mesBody =
            mesBody +
            "\n" +
            spacePadding(escapeDecorationSymbol(i)) +
            ": " +
            escapeDecorationSymbol(replaceWords[i]);
        }
        // 無を吐き出さないためのif
        if (mesBody) {
          // 書式を変更する
          mesBody = "```" + mesBody + "```";
          message.reply({content: mesBody});
          // if (message.deletable) message.delete();
        }
        break;
      default:
        message.reply(
          {content: "\n" +
            "config: 設定\n" +
            "add [対象] [読み方]: 読み替えを登録\n" +
            "delete [対象]: 読み替えを削除\n" +
            "list : 読み替えのリストを表示"}
        );
        break;
    }
  }
  // メッセージにBotへのメンションが含まれている かつ 送信者がサーバーVCにいるとき
  if (message.mentions.has(client.user!) && message.member?.voice.channel) {
    // 既に接続してますか？
    if (getVoiceConnection(message.guildId!)) { 
      // じゃけん再接続してくださいね～
      getVoiceConnection(message.guildId!)!.rejoin();
    } else {    
      // Botを接続させる
      let channelOpts : JoinVoiceChannelOptions & CreateVoiceConnectionOptions = {
        channelId: message.member!.voice.channelId!,
        guildId: message.guildId!,
        selfDeaf: true,
        adapterCreator: message.guild!.voiceAdapterCreator
      };
      joinVoiceChannel(channelOpts);
      console.log(`Attempting to join '${message.member!.voice.channelId!}'(${message.member!.voice.channel!.name}) Voice/StageChannel...`);

      // Wait for ready, Prepair AudioPlayer and Play Greeting.
      try {
        // Ready?
        entersState(getVoiceConnection(message.guildId!)!, VoiceConnectionStatus.Ready, 30e3);
        // VoiceConnection ====(Ｅｺ:] => AudioPlayer < ﾎﾟ→ﾎﾟﾝ↑
        subscStore.set(message.guildId!, new ChainSubscription(getVoiceConnection(message.guildId!)!));
        // Play 
        subscStore.get(message.guildId!)?.enqueue("output.mp3");
        entersState(subscStore.get(message.guildId!)!.audioPlayer, AudioPlayerStatus.Playing, 5e3)
      } catch (error) {
        subscStore.get(message.guildId!)?.stop();
        getVoiceConnection(message.guildId!)!.destroy();
        console.log(error);
      }
    }
    

    // Old things are down
    // message
    //   .member!.voice.channel.join()
    //   .then((c) => {
    //     connection = c;
    //     // 再生
    //     // eslint-disable-next-line
    //     const dispatcher = connection.play("output.mp3");
    //     // メッセージを消す権限があるときに消す
    //     if (message.deletable) message.delete();
    //   })
    //   .catch(console.log);
  }
});

// VCの状態が変更されたら発火
client.on("voiceStateUpdate", async (oldMember, newMember) => {
  try {
    //VCに接続済み？
    if (
      getVoiceConnection(oldMember.guild.id)?.joinConfig.channelId === oldMember.channelId || 
      getVoiceConnection(newMember.guild.id)?.joinConfig.channelId === newMember.channelId
    ) {
      // なんやらいろんな条件
      // 1. ボットじゃない事
      // 2. 今までいたチャンネルか今入ったチャンネルのどちらかにVCBotがいる事
      // 3. 同じチャンネルに出入りしていない事
      if (
        !newMember.member?.user.bot &&
        newMember.channelId !== oldMember.channelId
      ) {
        // DisplayName(ニックネームを取得)
        let dn = newMember.member!.displayName;

        //読み替え適用
        for (let i in replaceWords) {
          let re = new RegExp(escape(i), "g");
          dn = dn.replace(re, replaceWords[i]);
        }

        // Google Text to Speechに渡すリクエストをあらかじめ生成
        const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
          input: { text: dn },
          voice: {
            name: "ja-JP-Standard-A",
            languageCode: "ja-JP",
            ssmlGender: "NEUTRAL",
          },
          audioConfig: { audioEncoding: "MP3" },
        };

        // DisplayNameをハッシュする これ大丈夫なのか??
        const sha512 = createHash("sha512");
        const hashobj = sha512.update(dn).digest("hex");

        try {
          // ファイルがあるか確認
          statSync("./mp3/" + hashobj + ".mp3");
        } catch (error) {
          // 「ダメです！」なとき
          // ないとき
          if (!existsSync("./mp3/" + hashobj + ".mp3")) {
            // Googleに音声を作ってもらう
            console.log("hei");
            const [response] = await Gclient.synthesizeSpeech(request);
            // ToDo: writeFilesいい感じにして
            const writeFiles = promisify(writeFile);
            // 保存
            // ToDo: writeFilesいい感じにして
            await writeFiles(
              "./mp3/" + hashobj + ".mp3",
              response.audioContent!,
              "binary"
            );
          }
          // それ以外
          else {
            //エラー
            console.log(error);
          }
        }

        // Guildを跨いだ再生とロギング
        const targetSubscriptions = new Array<ChainSubscription | undefined>();
        targetSubscriptions.push(subscStore.get(oldMember.guild.id));
        targetSubscriptions.push(subscStore.get(newMember.guild.id));
        targetSubscriptions.filter((subsc) => 
          oldMember.channelId === subsc?.voiceConnection.joinConfig.channelId || 
          newMember.channelId === subsc?.voiceConnection.joinConfig.channelId
        );
        

        // 音声を再生 & ロギング(Resourceは使いまわせない)
        let isJoin = (oldMember.channelId === null || 
          typeof oldMember.channelId === "undefined" || 
          oldMember.channelId !== targetSubscriptions[0]?.voiceConnection.joinConfig.channelId) && 
          newMember.channelId === targetSubscriptions[0]?.voiceConnection.joinConfig.channelId;
          let isLeft = oldMember.channelId === targetSubscriptions[0]?.voiceConnection.joinConfig.channelId &&
          (newMember.channelId === null ||
            typeof newMember.channelId === "undefined" ||
            newMember.channelId !== targetSubscriptions[0]?.voiceConnection.joinConfig.channelId);
          if ((isJoin && isLeft) || (!isJoin && !isLeft)) {
            console.log("w,what happend...??");
          } else {
            targetSubscriptions[0]?.enqueue("./mp3/" + hashobj + ".mp3");
            targetSubscriptions[0]?.enqueue(isJoin ? "joined.mp3" : "leaved.mp3");
            // ログを表示
            if (getConf("guilds." + (isJoin ? newMember : oldMember).guild.id + ".logChannelId")) {
              client.channels.fetch(
                getConf("guilds." + (isJoin ? newMember : oldMember).guild.id + ".logChannelId")
              ).then( (ch) => {
                let textch = ch! as TextChannel;
                textch.send(
                  {content: escapeDecorationSymbol(
                    newMember.member!.displayName
                  ).replace(/@/g, "＠") + " " + (isJoin ? "joined": "left")}
                );
              });  
            }
          }
        

        //const dispatcher = targetConnection!.play("./mp3/" + hashobj + ".mp3");
        // 再生が終わったら
        // dispatcher.on("speaking", (value) => {
        //   if (!value) {
        //     if (
        //       (oldMember.channelID === null ||
        //         typeof oldMember.channelID === "undefined" ||
        //         oldMember.channelID !== targetConnection!.channel.id) &&
        //       newMember.channelID === targetConnection!.channel.id
        //     ) {
        //       // ログを表示
        //       if (getConf("guilds." + newMember.guild.id + ".logChannelId")) {
        //         (<TextChannel>(
        //           client.channels.cache.get(
        //             getConf("guilds." + newMember.guild.id + ".logChannelId")
        //           )
        //         )).send(
        //           escapeDecorationSymbol(
        //             newMember.member!.displayName
        //           ).replace(/@/g, "＠") + " joined"
        //         );
        //       }
        //       // ジョインド
        //       targetConnection!.play("./joined.mp3");
        //     } else if (
        //       oldMember.channelID === targetConnection!.channel.id &&
        //       (newMember.channelID === null ||
        //         typeof newMember.channelID === "undefined" ||
        //         newMember.channelID !== targetConnection!.channel.id)
        //     ) {
        //       // ログ
        //       if (getConf("guilds." + oldMember.guild.id + ".logChannelId")) {
        //         (<TextChannel>(
        //           client.channels.cache.get(
        //             getConf("guilds." + oldMember.guild.id + ".logChannelId")
        //           )
        //         )).send(
        //           escapeDecorationSymbol(
        //             newMember.member!.displayName
        //           ).replace(/@/g, "＠") + " left"
        //         );
        //       }
        //       // リーブド(教訓。NEVER FIX THIS)
        //       targetConnection!.play("./leaved.mp3");
        //     }
        //   }
        // });
        
      }
    }
  } catch (e) {
    console.log(e);
  }
});

// Botにログイン
client.login(token);
