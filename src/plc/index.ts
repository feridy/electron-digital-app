import S7 from 'nodes7';

const conn = new S7({
  debug: true
});

conn.initiateConnection(
  {
    host: '192.168.7.36',
    port: 102,
    rack: 0,
    slot: 2
  },
  (err) => {
    console.log(err);
  }
);
