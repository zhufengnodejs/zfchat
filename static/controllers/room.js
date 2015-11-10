angular.module('techNodeApp').controller('RoomCtrl', function($scope, socket) {
    socket.on('roomData', function (room) {
        $scope.room = room
    });

    socket.on('messages.add', function (message) {
        $scope.room.messages.push(message)
    });

    socket.emit('getRoom');

    socket.on('users.add', function (user) {
        $scope.room.users.push(user)
    })

    socket.on('users.remove', function (user) {
        var _userId = user._id;
        $scope.room.users = $scope.room.users.filter(function (user) {
            return user._id != _userId
        })
    })
})