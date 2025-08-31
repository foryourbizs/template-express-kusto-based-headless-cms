import { BaseRepository } from '@lib/baseRepository';


export default class FilesRepository extends BaseRepository<'default'> {
    protected getDatabaseName(): 'default' {
        return 'default';
    }

    
    

    

}