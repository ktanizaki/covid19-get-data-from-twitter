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

/*
const cronJob = new cron({
  cronTime: '00 0-59/3 * * * *', // 3分ごとに実行
  start: true, // newした後即実行するかどうか
  onTick: function() {
    commitMaskData();
  }
});
*/

commitMaskData();