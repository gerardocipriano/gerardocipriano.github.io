AOS.init();

//  Work experience cards

const experiencecards = document.querySelector(".experience-cards");
const exp = [
  {
    title: "Student Developer",
    cardImage: "assets/images/experience-page/ftp.jpg",
    place: "Italy, Formigine",
    time: "(Jul, 2020 - Oct, 2022)",
    desp: `<p>I worked in the technical support team for small and medium-sized businesses.</p>
    <p>I was responsible for monitoring and maintaining all systems related to the computer equipment of the client companies.</p>
    <p>I managed Microsoft 365 Tenants (exchange, office 365), GSUITE;</p>
    <p>Implementation and management of backups with Veeam B&R;</p>
    <p>Firewall management (mainly Sophos and Fortigate);</p>
    <p>Spam management (Libraesva and sophos)</p><br>
    
    <p>I carried out projects independently on behalf of customers:</p>
    <p>- Migrations to 365,</p>
    <p>- AD, GPO, WSUS and Hyper-V reorganization according to Microsoft best practices</p>`,
  },
  {
    title: "Help Desk",
    cardImage: "assets/images/experience-page/gpi.jpg",
    place: "Italy, Modena",
    time: "(Mar, 2018 - Jun, 2020)",
    desp: `<p>I worked as a Help Desk assistant for three major public entities in Modena:</p>
    <p>Azienda Ospedaliero-Universitaria Policlinico di Modena,</p>
    <p>Comune di Modena,</p>
    <p>Università degli Studi di Modena e Reggio Emilia.</p>
    <p>I was responsible for the hardware and software maintenance of clients.</p>
    <p>I provided on-site or first level support over the phone, using remote assistance software.</p><br>
    <p>I was involved in several special projects:</p>
    <p>Roll-Out and massive update of remaining PCs with Windows XP to Windows 10 at the Policlinico di Modena</p>
    <p>Roll-Out and massive update of PCs with Windows 7 to Windows 10 for UniMoRe (AGID adjustment)</p>`,
  },
];

const showCards2 = () => {
  let output = "";
  exp.forEach(
    ({ title, cardImage, place, time, desp }) =>
      (output += `        
    <div class="col gaap" data-aos="fade-up" data-aos-easing="linear" data-aos-delay="100" data-aos-duration="400"> 
      <div class="card card1">
        <img src="${cardImage}" class="featured-image"/>
        <article class="card-body">
          <header>
            <div class="title">
              <h3>${title}</h3>
            </div>
            <p class="meta">
              <span class="pre-heading">${place}</span><br>
              <span class="author">${time}</span>
            </p>
            <ol>
              ${desp}
            </ol>
          </header>
        </article>
      </div>
    </div>
      `)
  );
  experiencecards.innerHTML = output;
};
document.addEventListener("DOMContentLoaded", showCards2);

// Volunteership Cards

const volunteership = document.querySelector(".volunteership");
const volunteershipcards = [
  {

  },
];

const showCards = () => {
  let output = "";
  volunteershipcards.forEach(
    ({ title, cardImage, description }) =>
      (output += `        
      <div class="card volunteerCard" data-aos="fade-down" data-aos-easing="linear" data-aos-delay="100" data-aos-duration="600" style="height: 550px;width:400px">
      
      <img src="${cardImage}" height="250" width="65" class="card-img" style="border-radius:10px">
      <div class="content">
          <h2 class="volunteerTitle">${title}</h2><br>
          <p class="copy">${description}</p></div>
      
      </div>
      `)
  );
  volunteership.innerHTML = output;
};
document.addEventListener("DOMContentLoaded", showCards);



const showCards3 = () => {
  let output = "";
  mentor.forEach(
    ({ title, image, subtitle, desp, href }) =>
      (output += `  
      <div class="blog-slider__item swiper-slide">
        <div class="blog-slider__img">
            <img src="${image}" alt="">
        </div>
        <div class="blog-slider__content">
          <div class="blog-slider__title">${title}</div>
          <span class="blog-slider__code">${subtitle}</span>
          <div class="blog-slider__text">${desp}</div>
          <a href="${href}" class="blog-slider__button">Read More</a>   
        </div>
      </div>
      `)
  );
  hackathonsection.innerHTML = output;
};
document.addEventListener("DOMContentLoaded", showCards3);
