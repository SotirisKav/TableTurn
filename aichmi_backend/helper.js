let person1 = {
    firstName: "Sotiris",
    middleName: null,
    lastName: "Kavadakis",
    age: 21
};

let selection = 'age';
person1.middleName = "Danger";
person1[selection] = 20;
//console.log(person1);

let people = [person1];

let person2 = {
    firstName: "Elvira",
    middleName: 'Kavadaki',
    lastName: "Logothetidi",
    age: 23
};

people.push(person2);
console.log(people);

function greet(name) {
    console.log('Hello ' + name + '!');
}

greet(people[1].firstName);