import { Run } from './handler';

(async () => {
  await Run();
})().catch((e) => {
  console.error(e);
});
