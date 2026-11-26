import { apiError, ApiError, checkOrigin, readBody } from '@/lib/server/auth';
import { changeCvConsent } from '@/lib/server/cv-base-invites';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
export async function POST(req:Request,{params}:{params:Promise<{token:string}>}) {
  try {
    checkOrigin(req);
    if(!rateLimit('cv-consent:'+clientKey(req),{limit:30,windowMs:60000}).allowed) throw new ApiError('სცადეთ ცოტა ხანში.',429);
    const {action}=await readBody(req);
    if(action!=='consent'&&action!=='withdraw') throw new ApiError('მოქმედება არასწორია.',400);
    return Response.json(await changeCvConsent((await params).token,action),{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }catch(e){return apiError(e);}
}
