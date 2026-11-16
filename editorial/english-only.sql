begin;
update community.comments set name=replace(name,' · 编辑整理',''),body=replace(body,'Editorial digest · 编辑整理','Editorial digest') where visitor='editorial:2026-11-15';
commit;
