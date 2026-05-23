const words = [
    { word: "apple", length: 5 },
    { word: "banana", length: 6 },
    { word: "elephant", length: 8 },
    { word: "computer", length: 8 },
    { word: "keyboard", length: 8 },
    { word: "mountain", length: 8 },
    { word: "airplane", length: 8 },
    { word: "guitar", length: 6 },
    { word: "football", length: 8 },
    { word: "chocolate", length: 9 },
    { word: "hospital", length: 8 },
    { word: "internet", length: 8 },
    { word: "library", length: 7 },
    { word: "diamond", length: 7 },
    { word: "notebook", length: 8 },
    { word: "umbrella", length: 8 },
    { word: "sandwich", length: 8 },
    { word: "building", length: 8 },
    { word: "telephone", length: 9 },
    { word: "backpack", length: 8 },
    { word: "rocket", length: 6 },
    { word: "monster", length: 7 },
    { word: "penguin", length: 7 },
    { word: "kangaroo", length: 8 },
    { word: "calendar", length: 8 },
    { word: "dinosaur", length: 8 },
    { word: "painting", length: 8 },
    { word: "camera", length: 6 },
    { word: "rainbow", length: 7 },
    { word: "volcano", length: 7 },
    { word: "passport", length: 8 },
    { word: "triangle", length: 8 },
    { word: "battery", length: 7 },
    { word: "blanket", length: 7 },
    { word: "broccoli", length: 8 },
    { word: "crocodile", length: 9 },
    { word: "cupcake", length: 7 },
    { word: "drumstick", length: 9 },
    { word: "firetruck", length: 9 },
    { word: "hamburger", length: 9 },
    { word: "jellyfish", length: 9 },
    { word: "lighthouse", length: 10 },
    { word: "microscope", length: 10 },
    { word: "motorcycle", length: 10 },
    { word: "newspaper", length: 9 },
    { word: "octopus", length: 7 },
    { word: "pancake", length: 7 },
    { word: "playground", length: 10 },
    { word: "popcorn", length: 7 },
    { word: "pyramid", length: 7 },
    { word: "refrigerator", length: 12 },
    { word: "scissors", length: 8 },
    { word: "snowman", length: 7 },
    { word: "spaceship", length: 9 },
    { word: "strawberry", length: 10 },
    { word: "submarine", length: 9 },
    { word: "sunflower", length: 9 },
    { word: "toothbrush", length: 10 },
    { word: "treasure", length: 8 },
    { word: "watermelon", length: 10 },
    { word: "whirlpool", length: 9 },
    { word: "windmill", length: 8 },
    { word: "zookeeper", length: 9 },
    { word: "armchair", length: 8 },
    { word: "basketball", length: 10 },
    { word: "butterfly", length: 9 },
    { word: "calculator", length: 10 },
    { word: "campfire", length: 8 },
    { word: "castle", length: 6 },
    { word: "caterpillar", length: 11 },
    { word: "chimney", length: 7 },
    { word: "compass", length: 7 },
    { word: "curtain", length: 7 },
    { word: "dolphin", length: 7 },
    { word: "dragonfly", length: 9 },
    { word: "earphones", length: 9 },
    { word: "escalator", length: 9 },
    { word: "flashlight", length: 10 },
    { word: "fountain", length: 8 },
    { word: "headphones", length: 10 },
    { word: "helicopter", length: 10 },
    { word: "icecream", length: 8 },
    { word: "jacket", length: 6 },
    { word: "ladder", length: 6 },
    { word: "magician", length: 8 },
    { word: "necklace", length: 8 },
    { word: "ostrich", length: 7 },
    { word: "parachute", length: 9 },
    { word: "pepperoni", length: 9 },
    { word: "pineapple", length: 9 },
    { word: "pizzeria", length: 8 },
    { word: "planet", length: 6 },
    { word: "raincoat", length: 8 },
    { word: "scooter", length: 7 },
    { word: "seahorse", length: 8 },
    { word: "skateboard", length: 10 },
    { word: "suitcase", length: 8 },
    { word: "telescope", length: 9 },
    { word: "tornado", length: 7 },
    { word: "wheelchair", length: 10 }
  ];

  function selectWords(){
    const selectedWords=[]
    for(let i=1;i<=3;i++){
        let idx;
        if(i==1){
            idx= Math.floor(Math.random()*100)%40;
        }
        else if(i==2){
            idx= Math.floor(Math.random()*100)%80;
            if(idx<40) idx+=40;
        }
        else if(i==3){
            idx= Math.floor(Math.random()*100)%20;
            if(idx<80) idx+=80;
        }
        selectedWords.push(words[idx])
    }
    return selectedWords
  }

  export {selectWords}