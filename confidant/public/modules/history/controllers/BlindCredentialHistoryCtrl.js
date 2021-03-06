(function(angular) {
    'use strict';

    angular.module('confidant.history.controllers.BlindCredentialHistoryCtrl', [
        'ui.router',
        'ngResource',
        'xeditable',
        'confidant.resources.services',
        'confidant.history.services'
    ])


    .controller('history.BlindCredentialHistoryCtrl', [
        '$scope',
        '$stateParams',
        '$filter',
        '$q',
        '$log',
        '$location',
        'blindcredentials.credential',
        'blindcredentials.archiveCredentialRevisions',
        'history.ResourceArchiveService',
        function ($scope, $stateParams, $filter, $q, $log, $location, BlindCredential, BlindCredentialArchiveRevisions, ResourceArchiveService) {
            function doQuery(blindCredential, id) {
                var d = $q.defer(),
                    result = blindCredential.get({'id': id}, function() { d.resolve(result); });
                return d.promise;
            }

            $scope.$log = $log;
            $scope.revisions = [];

            var idArr = $stateParams.blindCredentialId.split('-');
            $scope.blindCredentialRevision = parseInt(idArr.pop(), 10);
            $scope.blindCredentialId = idArr.join('-');
            BlindCredentialArchiveRevisions.get({'id': $scope.blindCredentialId}).$promise.then(function(revisions) {
                $scope.revisions = $filter('orderBy')(revisions.revisions, 'revision', true);
                $scope.currentRevision = parseInt($scope.revisions[0].revision, 10);
                $scope.isOnlyRevision = false;
                $scope.isCurrentRevision = false;
                if ($scope.currentRevision === 1) {
                    $scope.isOnlyRevision = true;
                    $scope.diffRevision = $scope.currentRevision;
                    BlindCredential.get({'id': $stateParams.blindCredentialId}).$promise.then(function(blindCredential) {
                        $scope.currentBlindCredential = blindCredential;
                        $scope.diffBlindCredential = blindCredential;
                    }, function() {
                        $scope.currentBlindCredential = null;
                        $scope.diffBlindCredential = null;
                    });
                } else {
                    if ($scope.blindCredentialRevision === $scope.currentRevision) {
                        $scope.diffRevision = $scope.currentRevision - 1;
                    } else {
                        $scope.diffRevision = $scope.blindCredentialRevision;
                    }
                    var currentBlindCredentialPromise = doQuery(BlindCredential, $scope.blindCredentialId + '-' + $scope.currentRevision),
                        diffBlindCredentialPromise = doQuery(BlindCredential, $scope.blindCredentialId + '-' + $scope.diffRevision);
                    $q.all([currentBlindCredentialPromise, diffBlindCredentialPromise]).then(function(results) {
                        $scope.currentBlindCredential = results[0];
                        $scope.diffBlindCredential = results[1];
                    }, function() {
                        $scope.currentBlindCredential = null;
                        $scope.diffBlindCredential = null;
                    });
                }
                if ($scope.currentRevision === $scope.credentialRevision) {
                    $scope.isCurrentRevision = true;
                }
            });

            $scope.revertToDiffRevision = function() {
                var deferred = $q.defer();
                if (angular.equals($scope.diffBlindCredential.name, $scope.currentBlindCredential.name) &&
                    angular.equals($scope.diffBlindCredential.credential_keys, $scope.currentBlindCredential.credential_keys) &&
                    angular.equals($scope.diffBlindCredential.credential_pairs, $scope.currentBlindCredential.credential_pairs) &&
                    angular.equals($scope.diffBlindCredential.metadata, $scope.currentBlindCredential.metadata) &&
                    angular.equals($scope.diffBlindCredential.enabled, $scope.currentBlindCredential.enabled)) {
                    $scope.saveError = 'Can not revert to revision ' + $scope.diffBlindCredential.revision + '. No difference between it and current revision.';
                    deferred.reject();
                    return deferred.promise;
                }
                BlindCredential.update({'id': $scope.blindCredentialId}, $scope.diffBlindCredential).$promise.then(function(newBlindCredential) {
                    deferred.resolve();
                    ResourceArchiveService.updateResourceArchive();
                    $location.path('/history/blind_credential/' + newBlindCredential.id + '-' + newBlindCredential.revision);
                }, function(res) {
                    if (res.status === 500) {
                        $scope.saveError = 'Unexpected server error.';
                        $log.error(res);
                    } else {
                        $scope.saveError = res.data.error;
                        if ('conflicts' in res.data) {
                            $scope.blindCredentialPairConflicts = res.data.conflicts;
                        }
                    }
                    deferred.reject();
                });
                return deferred.promise;
            };

        }])

    ;

})(window.angular);
