Now we need to make a frontend 

I will give you the idea step by step

so we are going to upload this front via github page in the end

we will check the time automatically by the user and put that as the default start time and week day
User will give start to end time and the building information from all the building we have which is 

<select name="uBuilding" id="uBuilding"><option value="113" selected="">GS칼텍스산학협력관</option><option value="998">LearnUs 오픈스튜디오</option><option value="212">경영관</option><option value="208">과학관</option><option value="111">과학원</option><option value="204">광복관</option><option value="205">광복관 별관</option><option value="312">교육과학관</option><option value="800">김대중도서관</option><option value="617">대강당</option><option value="308">대우관 별관</option><option value="307">대우관 본관</option><option value="117">대운동장</option><option value="203">백양관</option><option value="130">백양누리</option><option value="309">빌링슬리관</option><option value="207">삼성관</option><option value="611">상남경영관</option><option value="707">새천년관</option><option value="305">성암관</option><option value="110">스포츠과학관</option><option value="303">아펜젤러관</option><option value="118">야구장</option><option value="301">언더우드관</option><option value="701">언어연구교육원</option><option value="202">연세·삼성 학술정보관</option><option value="306">연희관</option><option value="313">외솔관</option><option value="314">외솔관2</option><option value="315">원두우 신학관</option><option value="311">위당관</option><option value="310">유억겸기념관</option><option value="702">이윤재관</option><option value="102">제1공학관</option><option value="103">제2공학관</option><option value="105">제3공학관</option><option value="124">제4공학관</option><option value="112">첨단과학기술연구관</option><option value="108">체육관</option><option value="109">체육교육관</option><option value="618">학생회관</option></select>

we should select the building information

and based on this we will see which room are empty inside the building 

we will connect this to db in the future but trying to test it using data/2025-09-15_weeks1.jsonl


Also when finding empty room we will use this logic
first we will give all the room inisde each building

So when we check the time and the building wanting to find the empty room
we will check occupied room inside the time from which we gave as an input
than the rooms that are not in that list we obtained will be the empty room that we can go inside
