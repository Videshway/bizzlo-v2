import dns from 'node:dns/promises';

const domain = process.env.BIZZLO_DOMAIN || 'bizzlo.co';

async function check(label, fn) {
  try {
    const value = await fn();
    console.log(`PASS ${label}: ${JSON.stringify(value)}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${label}: ${error.message}`);
    return false;
  }
}

const results = await Promise.all([
  check('A/AAAA or CNAME', async () => {
    try {
      return await dns.resolve4(domain);
    } catch {
      return await dns.resolveCname(domain);
    }
  }),
  check('MX', () => dns.resolveMx(domain)),
  check('SPF TXT', async () => {
    const records = await dns.resolveTxt(domain);
    const flat = records.map((row) => row.join(''));
    const spf = flat.find((record) => record.startsWith('v=spf1'));
    if (!spf) throw new Error('SPF record missing');
    return spf;
  }),
  check('DMARC TXT', async () => {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = records.map((row) => row.join(''));
    const dmarc = flat.find((record) => record.startsWith('v=DMARC1'));
    if (!dmarc) throw new Error('DMARC record missing');
    return dmarc;
  }),
  check('CAA', () => dns.resolveCaa(domain)),
]);

if (results.some((ok) => !ok)) process.exit(1);
