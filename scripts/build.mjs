import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
for(const file of ['index.html','styles.css','src','staticwebapp.config.json']) await cp(file,`dist/${file}`,{recursive:true});
console.log('Static website prepared in dist/.');
