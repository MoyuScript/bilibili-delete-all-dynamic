import got from 'got';
import { config } from 'dotenv';

config();

const { COOKIE_STRING } = process.env;

const csrfMatch = COOKIE_STRING.match(/bili_jct=(.*?);/);

if (!csrfMatch) {
  throw new Error('Cookie 缺少 bili_jct');
}

const csrf = csrfMatch[1];

const headers = {
  'cookie': COOKIE_STRING
}

async function getSelfUid() {
  const req = got('https://api.bilibili.com/x/web-interface/nav', {
    headers
  });
  const resp = await req.json();

  return resp.data.mid;
}

async function *getDynamicListGenerator() {
  let offset = '0';
  const uid = await getSelfUid();
  while (true) {
    const params = new URLSearchParams([
      ['host_uid', String(uid)],
      ['offset_dynamic_id', offset],
      ['need_top', '0']
    ])
    console.log('拉取动态 offset=', offset);
    const req = got('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history', {
      headers,
      searchParams: params
    });

    const resp = await req.json();
    
    if (!resp.data.cards) {
      break;
    }
    const cards = resp.data.cards.filter((i) => [1, 2, 4].includes(i.desc.type)).map((i) => {
      i.card = JSON.parse(i.card);
      return i;
    });

    yield *cards;

    if (!resp.data.has_more) {
      break;
    }

    offset = String(resp.data.cards.at(-1).desc.dynamic_id_str);
  }
}

async function deleteDynamic(id) {
  const req = got('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic', {
    method: 'POST',
    form: {
      csrf: csrf,
      csrf_token: csrf,
      dynamic_id: id
    },
    headers
  });

  return req.json();
}

(async () => {
  const dynamicList = getDynamicListGenerator();
  for await (const item of dynamicList) {
    console.log('删除：', item.card.item.content);
    const {code, msg} = await deleteDynamic(item.desc.dynamic_id_str);

    if (code === 0) {
      console.log('删除成功')
    } else {
      console.log(msg)
    }
  }
})();