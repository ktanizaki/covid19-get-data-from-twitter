'use strict';
const Twit = require('twit');
const cron = require('cron').CronJob;
require('dotenv').config();
const got = require('got');
const request = require('request');

const twitter = new Twit({
  consumer_key: process.env.TWITTER_API_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_API_CONSUMER_SECRET,
  access_token: process.env.TWITTER_API_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_API_ACCESS_TOKEN_SECRET
});

let checkedTweets = [];
let maskdata = [];
const month ={'Jan': '01','Feb': '02','Mar': '03','Apr': '04','May': '05','Jun': '06','Jul': '07','Aug': '08','Sep': '09','Oct': '10','Nov': '11','Dec': '12'}

// Twitterから該当するツイートを取得し、mask_status.jsonにマスクあり・マスクなしの人数を追加してGitHubにcommitする
function commitMaskData(){
  // ハッシュタグ #anti-cov-degulab のツイートを取得
  twitter.get('search/tweets', {
    q: '#anticovdegulab'
  }, function(error, tweets, response) {
    if (error) console.log(error);

    // ハッシュタグの文字列や余計な空白を削除
    tweets.statuses.forEach(function(dataTweet, key) {
      // マスクあり・なしの人数を配列に格納
      let masks = dataTweet.text.replace('#anticovdegulab','').split(',');
      // 年月日の形式を変換して配列に追加
      masks.push(dataTweet.created_at.split(' ')[5] + '-' + month[dataTweet.created_at.split(' ')[1]] + '-' + dataTweet.created_at.split(' ')[2])
      maskdata.push(masks.map(e => e.trim()))
    });
    console.log(maskdata);

    // GitHubからmask_status.jsonのcontentとshaを取得しデコード
    (async () => {
      try {
        const response = await got('https://api.github.com/repos/ktanizaki/covid19/contents/data/mask_status.json');
        const parseResponse = JSON.parse(response.body)
        const decodedContent = JSON.parse(Buffer.from(parseResponse.content, 'base64').toString());
        const sha = parseResponse.sha
        //console.log(decodedContent);
        //console.log(sha);

        // ツイートから取得したマスクあり・なし人数をjsonに追加
        maskdata.forEach(m => {
          // すでに同じ日のデータがあれば値を足す. m[0]はマスクあり人数, m[1]はマスクなし人数, m[2]は年月日
          if(decodedContent.data.filter(d => d.date === m[2]).length > 0) {
            decodedContent.data.filter(d => d.date === m[2])[0].mask += parseInt(m[0])
            decodedContent.data.filter(d => d.date === m[2])[0].no_mask += parseInt(m[1])
          }
          // 同じ日のデータがなければ要素を追加する
          else {
            let addData =  { date : m[2], mask: parseInt(m[0]), no_mask : parseInt(m[1]) }
            decodedContent.data.push(addData)
          }
        })
        //console.log(JSON.stringify(decodedContent, null, 4))

        // base64にエンコード
        const base64str = Buffer.from(JSON.stringify(decodedContent, null, 4)).toString('base64');
        //console.log(base64str)

        // GitHubにcommitを送信
        (async () => {
          try {
            const options = {
              url: 'https://api.github.com/repos/ktanizaki/covid19/contents/data/mask_status.json',
              method: 'PUT',
              headers: {
                "Authorization": `token ${process.env.GITHUB_API_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent": "ktanizaki"
              },
              body: {
                "message": "Update mask_status.json",
                "committer": {
                  "name": "ktanizaki",
                  "email": "kouichi.tanizaki@gmail.com"
                },
                "content": base64str,
                "sha": sha
              },
              json: true
            };
            
            request(options, (error, response, body)=>{
              console.log(response);
            });
          } catch(e) {
            console.log(`ERROR:\n${JSON.stringify(e)}`);
          }
        })();

      } catch (error) {
        console.log(error.response.body);
      }
    })();
  });
}

function getGitHub() {
  // GitHubからmask_status.jsonのcontentとshaを取得しデコード
  // https://nju33.com/nodejs/GitHub%20API%20%E3%81%8B%E3%82%89%E3%81%82%E3%82%8B%E3%83%AA%E3%83%9D%E3%82%B8%E3%83%88%E3%83%AA%E3%81%AE%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E5%86%85%E5%AE%B9%E5%8F%96%E5%BE%97
  (async () => {
    const {body} = await got(
      'https://api.github.com/repos/ktanizaki/covid19/contents/data/mask_status.json',
      {
        json: true,
        headers: {
          accept: 'application/vnd.github.v3+json',
          "Authorization": `token ${process.env.GITHUB_API_ACCESS_TOKEN}`
        }
      }
    );
    // contentはbase64なのでデコード
    //const decodedContent = Buffer.from(body.content, 'base64').toString();
    //const sha = body.sha
    //console.log(decodedContent);
    //console.log(sha);
  })().catch(err => {
    console.log(err);
  });
}


function getGitHubTest() {
  (async () => {
    try {
      const response = await got('https://api.github.com/repos/ktanizaki/covid19/contents/data/mask_status.json');
      const parseResponse = JSON.parse(response.body)
      //console.log(parseResponse.name)
      const decodedContent = JSON.parse(Buffer.from(parseResponse.content, 'base64').toString());
      const sha = parseResponse.sha
      console.log(decodedContent.data.filter(d => d.date === '2020-06-05'));
      //console.log(sha);

      // データを追加する
      decodedContent.data.filter(d => d.date === '2020-06-05')[0].mask += 10
      decodedContent.data.filter(d => d.date === '2020-06-05')[0].no_mask += 10
      console.log(decodedContent.data.filter(d => d.date === '2020-06-05'));

    } catch (error) {
      console.log(error.response.body);
    }
  })();
}

function commitGitHubTest() {
  (async () => {
    try {
      const response = await got('https://api.github.com/repos/ktanizaki/covid19/contents/data/hello.txt');
      const parseResponse = JSON.parse(response.body)
      //console.log(parseResponse.name)
      let decodedContent = Buffer.from(parseResponse.content, 'base64').toString();
      const sha = parseResponse.sha

      console.log(decodedContent);
      console.log(sha);

      // データを追加する
      decodedContent = decodedContent + 'abc'
      console.log(decodedContent);

      // Base64にエンコードする
      const base64str = Buffer.from(decodedContent).toString('base64');
      
      // GitHubにcommitする
      (async () => {
        try {
          const options = {
            url: 'https://api.github.com/repos/ktanizaki/covid19/contents/data/hello.txt',
            method: 'PUT',
            headers: {
              "Authorization": `token ${process.env.GITHUB_API_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
              "User-Agent": "ktanizaki"
            },
            body: {
              "message": "Update hello.txt",
              "committer": {
                "name": "ktanizaki",
                "email": "kouichi.tanizaki@gmail.com"
              },
              "content": base64str,
              "sha": sha
            },
            json: true
          };
          
          request(options, (error, response, body)=>{
            //console.log(error);
            console.log(response);
            //console.log(body);
          });
        } catch(e) {
          console.log(`ERROR:\n${JSON.stringify(e)}`);
        }
      })();

    } catch (error) {
      console.log(error.response.body);
    }
  })();
}

function getData() {
  // タイムラインのツイートを取得
  twitter.get('statuses/home_timeline', {}, function(error, tweets, response) {
    if (error) console.log(error);

    // 初回起動時は取得するだけで終了
    if (checkedTweets.length === 0) {
      tweets.forEach(function(homeTimeLineTweet, key) {
        checkedTweets.push(homeTimeLineTweet); // 配列に追加
      });

      return;
    }

    const newTweets = [];
    tweets.forEach(function(homeTimeLineTweet, key) {
      if (isCheckedTweet(homeTimeLineTweet) === false) {
        responseHomeTimeLine(homeTimeLineTweet);
        newTweets.push(homeTimeLineTweet); // 新しいツイートを追加
      }
    });

    // 調査済みリストに追加と、千個を超えていたら削除
    checkedTweets = newTweets.concat(checkedTweets); // 配列の連結
    if (checkedTweets.length > 1000) checkedTweets.length = 1000; // 古い要素を消して要素数を1000個にする。
  });
}

function isCheckedTweet(homeTimeLineTweet) {
  // ボット自身のツイートは無視する。
  if (homeTimeLineTweet.user.screen_name === 'BotKtan') {
    return true;
  }

  for (let checkedTweet of checkedTweets) {
    // 同内容を連続投稿するアカウントがあるため、一度でも返信した内容は返信しない仕様にしています。
    if (checkedTweet.id_str === homeTimeLineTweet.id_str || checkedTweet.text === homeTimeLineTweet.text) {
      return true;
    }
  }

  return false;
}

const responses = ['面白い!', 'すごい！', 'なるほど！'];

function responseHomeTimeLine(homeTimeLineTweet) {
  const tweetMessage = '@' + homeTimeLineTweet.user.screen_name + '「' + homeTimeLineTweet.text + '」' + responses[Math.floor(Math.random() * responses.length)];
  twitter.post('statuses/update', {
    status: tweetMessage,
    in_reply_to_status_id: homeTimeLineTweet.id_str
  }).then((tweet) => {
    console.log(tweet);
  }).catch((error) => {
    throw error;
  });
}

/*
const stream = twitter.stream('statuses/filter', { track: '@BotKtan' });
stream.on('tweet', function(tweet) {
  console.log(tweet.text);

  const tweetMessage = '@' + tweet.user.screen_name + ' 呼んだ？　(*´ω｀*)';
  twitter.post('statuses/update', {
    status: tweetMessage,
    in_reply_to_status_id: tweet.id_str
  })
  .then((tweet) => {
    console.log(tweet);
  })
  .catch((error) => {
    throw error;
  });
});

stream.on('error', function(error) {
  throw error;
});
*/

function replyToMention(){
  var params = {screen_name: 'BotKtan'};
  twitter.get('statuses/mentions_timeline', params, function(error, tweets, response) {
    if (!error) {
      for( let [index, tweet] of tweets.entries()) {
        //console.log(tweet.id_str);
        //console.log(tweet.user.screen_name);
        if (index > 0) return;
        //console.log(index);
        const tweetMessage = '@' + tweet.user.screen_name + ' 呼んだ？　(*´ω｀*)';
        twitter.post('statuses/update', {
          status: tweetMessage,
          in_reply_to_status_id: tweet.id_str
        }).then((tweet) => {
          console.log(tweet);
        })
        .catch((error) => {
          throw error;
        });
      }
    }
  });
}

/*
const cronJob = new cron({
  cronTime: '00 0-59/3 * * * *', // 3分ごとに実行
  start: true, // newした後即実行するかどうか
  onTick: function() {
    //getHomeTimeLine();
    replyToMention();
  }
});
*/

commitMaskData();
//commitGitHubTest();