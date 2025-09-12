import { ExpressRouter } from '@lib/expressRouter'
import { serialize } from '@lib/serializer'
const router = new ExpressRouter();


router
.GET(async (req, res, injected, repo, db) => {
    res.status(200);

    const fileRepo = repo.getRepository('defaultFile');

    const xx = await fileRepo.getFilesListSimply();
    
    // BigInt를 안전하게 직렬화
    const serializedData = serialize({ xx });

    return res.json(serializedData);
})



export default router.build();
